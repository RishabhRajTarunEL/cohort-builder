"""
UI Component Generator for Natural Language Query Agent

Determines appropriate UI components based on field data type, cardinality,
and user query context.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd

logger = logging.getLogger(__name__)


def generate_ui_components(
    criteria_list: List[Dict[str, Any]],
    db_schema: Dict,
    concept_df: pd.DataFrame
) -> List[Dict[str, Any]]:
    """
    Generate UI component configurations for each criterion based on field type and cardinality.
    
    Args:
        criteria_list: List of criteria with db_mappings
        db_schema: Database schema with field information
        concept_df: Concept table DataFrame
    
    Returns:
        Updated criteria list with ui_component added to each mapping
    """
    for criterion in criteria_list:
        db_mappings = criterion.get('db_mappings', {})
        
        for entity, mapping in db_mappings.items():
            table_field = mapping.get('table.field')
            if not table_field or '.' not in table_field:
                continue
            
            table, field = table_field.split('.', 1)
            
            # Get field metadata from schema
            if table not in db_schema or field not in db_schema[table].get('fields', {}):
                logger.warning(f"Field {table_field} not found in schema")
                continue
            
            field_info = db_schema[table]['fields'][field]
            data_type = field_info.get('field_data_type', 'object')
            
            # Get unique values and cardinality from concept_df
            unique_values, cardinality = _get_unique_values(
                concept_df, table, field
            )
            
            # Get mapped_concept (pre-selected values from agent)
            mapped_concept = mapping.get('mapped_concept')
            
            # Determine appropriate component
            component = _determine_component_type(
                data_type=data_type,
                cardinality=cardinality,
                field_info=field_info,
                unique_values=unique_values,
                entity=entity,
                table_field=table_field,
                mapped_concept=mapped_concept
            )
            
            mapping['ui_component'] = component
    
    return criteria_list


def _get_unique_values(
    concept_df: pd.DataFrame,
    table: str,
    field: str
) -> Tuple[List[str], int]:
    """Get unique values and cardinality for a field"""
    try:
        subset = concept_df[
            (concept_df['table_name'] == table) &
            (concept_df['field_name'] == field)
        ]
        unique_values = subset['concept_name'].unique().tolist()
        cardinality = len(unique_values)
        return unique_values, cardinality
    except Exception as e:
        logger.warning(f"Failed to get unique values for {table}.{field}: {e}")
        return [], 0


def _determine_component_type(
    data_type: str,
    cardinality: int,
    field_info: Dict,
    unique_values: List[str],
    entity: str,
    table_field: str,
    mapped_concept: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Decision tree for component selection based on data type and cardinality.
    
    Component Selection Logic:
    - Boolean (cardinality=2): Toggle
    - Date/DateTime: DateRangePicker
    - Numeric with range: RangeSlider
    - Numeric without range: NumberInput
    - Categorical (2-8 values): CheckboxList
    - Categorical (9-20 values): Dropdown
    - Categorical (21-50 values): MultiSelect
    - Categorical (50+ values): Autocomplete
    
    Args:
        mapped_concept: Pre-selected values from the agent (used to pre-check checkboxes)
    """
    data_type_lower = data_type.lower()
    
    # Boolean types - ONLY for actual boolean data types
    if data_type_lower in ['bool', 'boolean']:
        return _generate_toggle_component(field_info, unique_values, table_field)
    
    # Date/Time types
    if any(dt in data_type_lower for dt in ['date', 'datetime', 'timestamp']):
        return _generate_date_range_component(field_info, entity, table_field)
    
    # Numeric types
    if any(nt in data_type_lower for nt in ['int', 'float', 'double', 'numeric', 'decimal']):
        # Check if bounded range exists
        value_range = field_info.get('value_range', {})
        if value_range and cardinality > 20:
            return _generate_range_slider_component(field_info, entity, table_field, value_range)
        else:
            return _generate_number_input_component(field_info, entity, table_field)
    
    # Categorical/String types
    # < 10 items: show checkboxes
    # >= 10 items: show autocomplete with checkboxes
    if cardinality < 10:
        return _generate_checkbox_list_component(field_info, unique_values, table_field, mapped_concept)
    else:
        return _generate_autocomplete_component(field_info, unique_values, table_field, mapped_concept)


def _parse_entity_comparison(entity: str) -> Tuple[str, Any]:
    """
    Parse entity text to extract operator and value.
    
    Examples:
        "less than 8" -> ("less_than", 8)
        "greater than or equal to 50" -> ("greater_equal", 50)
        "between 10 and 20" -> ("between", [10, 20])
    """
    entity_lower = entity.lower().strip()
    
    # Between pattern
    between_match = re.search(r'between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)', entity_lower)
    if between_match:
        val1, val2 = float(between_match.group(1)), float(between_match.group(2))
        return ("between", [val1, val2])
    
    # Greater than or equal
    if 'greater than or equal' in entity_lower or '>=' in entity:
        value = re.search(r'(\d+(?:\.\d+)?)', entity)
        return ("greater_equal", float(value.group(1)) if value else 0)
    
    # Less than or equal
    if 'less than or equal' in entity_lower or '<=' in entity:
        value = re.search(r'(\d+(?:\.\d+)?)', entity)
        return ("less_equal", float(value.group(1)) if value else 0)
    
    # Greater than
    if 'greater than' in entity_lower or '>' in entity:
        value = re.search(r'(\d+(?:\.\d+)?)', entity)
        return ("greater_than", float(value.group(1)) if value else 0)
    
    # Less than
    if 'less than' in entity_lower or '<' in entity:
        value = re.search(r'(\d+(?:\.\d+)?)', entity)
        return ("less_than", float(value.group(1)) if value else 0)
    
    # Equals
    if 'equals' in entity_lower or '=' in entity:
        value = re.search(r'(\d+(?:\.\d+)?)', entity)
        return ("equals", float(value.group(1)) if value else 0)
    
    # Default: try to extract number
    value_match = re.search(r'(\d+(?:\.\d+)?)', entity)
    if value_match:
        return ("equals", float(value_match.group(1)))
    
    return ("equals", entity)


def _calculate_step(value_range: Dict) -> float:
    """Calculate appropriate step size for slider based on range"""
    min_val = value_range.get('min', 0)
    max_val = value_range.get('max', 100)
    range_size = max_val - min_val
    
    if range_size < 1:
        return 0.01
    elif range_size < 10:
        return 0.1
    elif range_size < 100:
        return 1
    elif range_size < 1000:
        return 10
    else:
        return 100


def _generate_slider_marks(value_range: Dict) -> Dict[str, str]:
    """Generate slider marks at key positions"""
    min_val = value_range.get('min', 0)
    max_val = value_range.get('max', 100)
    mean_val = value_range.get('mean')
    
    marks = {
        str(min_val): str(min_val),
        str(max_val): str(max_val)
    }
    
    if mean_val is not None:
        marks[str(mean_val)] = f"{mean_val} (Avg)"
    
    # Add quartile marks if available
    if 'percentiles' in value_range:
        p25 = value_range['percentiles'].get('25')
        p75 = value_range['percentiles'].get('75')
        if p25:
            marks[str(p25)] = str(p25)
        if p75:
            marks[str(p75)] = str(p75)
    
    return marks


# Component Generators

def _generate_range_slider_component(
    field_info: Dict,
    entity: str,
    table_field: str,
    value_range: Dict
) -> Dict[str, Any]:
    """Generate Range Slider configuration"""
    operator, value = _parse_entity_comparison(entity)
    
    return {
        "type": "range_slider",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": field_info.get('field_data_type'),
            "unit": field_info.get('unit', ''),
            "min": value_range.get('min', 0),
            "max": value_range.get('max', 100),
            "step": _calculate_step(value_range),
            "default_value": value if not isinstance(value, list) else value[0],
            "current_operator": operator,
            "current_value": value,
            "marks": _generate_slider_marks(value_range),
            "tooltip": field_info.get('tooltip', ''),
            "validation": {
                "min_required": True,
                "max_required": operator == "between"
            }
        },
        "operator_options": [
            {"value": "less_than", "label": "<", "description": "Less than", "requires": "single_value"},
            {"value": "greater_than", "label": ">", "description": "Greater than", "requires": "single_value"},
            {"value": "equals", "label": "=", "description": "Equals", "requires": "single_value"},
            {"value": "between", "label": "between", "description": "Between (inclusive)", "requires": "range"},
            {"value": "less_equal", "label": "≤", "description": "Less than or equal", "requires": "single_value"},
            {"value": "greater_equal", "label": "≥", "description": "Greater than or equal", "requires": "single_value"}
        ]
    }


def _generate_number_input_component(
    field_info: Dict,
    entity: str,
    table_field: str
) -> Dict[str, Any]:
    """Generate Number Input configuration"""
    operator, value = _parse_entity_comparison(entity)
    
    return {
        "type": "number_input",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": field_info.get('field_data_type'),
            "unit": field_info.get('unit', ''),
            "min": 0,
            "max": None,
            "step": 0.1 if 'float' in field_info.get('field_data_type', '').lower() else 1,
            "default_value": value if not isinstance(value, list) else value[0],
            "current_operator": operator,
            "current_value": value,
            "placeholder": f"Enter {field_info.get('field_description', 'value')}",
            "validation": {
                "required": True,
                "min": 0
            }
        },
        "operator_options": [
            {"value": "greater_than", "label": ">", "requires": "single_value"},
            {"value": "less_than", "label": "<", "requires": "single_value"},
            {"value": "equals", "label": "=", "requires": "single_value"},
            {"value": "greater_equal", "label": "≥", "requires": "single_value"},
            {"value": "less_equal", "label": "≤", "requires": "single_value"},
            {"value": "between", "label": "between", "requires": "range"}
        ]
    }


def _generate_dropdown_component(
    field_info: Dict,
    unique_values: List[str],
    table_field: str
) -> Dict[str, Any]:
    """Generate Dropdown (single select) configuration"""
    # Create options with counts if available
    options = []
    for value in unique_values[:20]:  # Limit to 20
        options.append({
            "value": value,
            "label": value,
            "description": f"Select {value}"
        })
    
    return {
        "type": "dropdown_single",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "string",
            "current_value": unique_values[0] if unique_values else None,
            "placeholder": f"Select {field_info.get('field_description', 'value')}",
            "allow_clear": True,
            "searchable": len(unique_values) > 10,
            "options": options,
            "metadata": {
                "total_unique": len(unique_values),
                "field_description": field_info.get('field_description', '')
            }
        },
        "operator_options": [
            {"value": "equals", "label": "is", "requires": "single_value"},
            {"value": "not_equals", "label": "is not", "requires": "single_value"}
        ]
    }


def _generate_multiselect_component(
    field_info: Dict,
    unique_values: List[str],
    table_field: str
) -> Dict[str, Any]:
    """Generate Multi-Select Dropdown configuration"""
    options = []
    for value in unique_values[:50]:  # Limit to 50
        options.append({
            "value": value,
            "label": value,
            "description": f"Include {value}"
        })
    
    return {
        "type": "multiselect_dropdown",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "string",
            "current_values": [],
            "placeholder": f"Select one or more {field_info.get('field_description', 'values')}",
            "searchable": True,
            "max_selections": None,
            "show_select_all": True,
            "show_selected_count": True,
            "options": options,
            "metadata": {
                "total_unique": len(unique_values),
                "field_description": field_info.get('field_description', '')
            }
        },
        "operator_options": [
            {"value": "in", "label": "is any of", "requires": "multiple_values"},
            {"value": "not_in", "label": "is none of", "requires": "multiple_values"}
        ]
    }


def _generate_autocomplete_component(
    field_info: Dict,
    unique_values: List[str],
    table_field: str,
    mapped_concept: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Generate Autocomplete configuration for high cardinality fields
    
    Args:
        mapped_concept: Pre-selected values from the agent
    """
    # Show top 10 most common as suggestions
    popular_values = unique_values[:10]
    
    # Use mapped_concept as pre-selected values if available
    selected_values = []
    if mapped_concept:
        # Filter to only valid values with case-insensitive matching
        valid_values = set(unique_values)
        valid_values_lower = {v.lower(): v for v in valid_values}
        
        for concept in mapped_concept:
            if concept in valid_values:
                selected_values.append(concept)
            elif concept.lower() in valid_values_lower:
                selected_values.append(valid_values_lower[concept.lower()])
        
        logger.info(f"Pre-selecting autocomplete values for {table_field}: mapped_concept={mapped_concept}, selected={selected_values}")
    
    return {
        "type": "autocomplete",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "string",
            "current_value": selected_values[0] if selected_values else "",
            "selected_values": selected_values,  # Pre-selected values from agent
            "placeholder": f"Type to search {field_info.get('field_description', 'values')}...",
            "min_search_length": 2,
            "max_results": 10,
            "debounce_ms": 300,
            "allow_custom_value": False,
            "search_mode": "contains",
            "case_sensitive": False,
            "suggestions": {
                "popular": popular_values
            },
            "metadata": {
                "total_unique": len(unique_values),
                "field_description": field_info.get('field_description', '')
            }
        },
        "operator_options": [
            {"value": "equals", "label": "is", "requires": "single_value"},
            {"value": "not_equals", "label": "is not", "requires": "single_value"},
            {"value": "in", "label": "is any of", "requires": "multiple_values"}
        ]
    }


def _generate_date_range_component(
    field_info: Dict,
    entity: str,
    table_field: str
) -> Dict[str, Any]:
    """Generate Date Range Picker configuration"""
    # Try to parse dates from entity
    current_value = {"start": None, "end": None}
    operator = "between"
    
    # Simple date range parsing
    date_pattern = r'(\d{4})-?(\d{2})?-?(\d{2})?'
    dates = re.findall(date_pattern, entity)
    if dates and len(dates) >= 2:
        current_value["start"] = f"{dates[0][0]}-{dates[0][1] or '01'}-{dates[0][2] or '01'}"
        current_value["end"] = f"{dates[1][0]}-{dates[1][1] or '12'}-{dates[1][2] or '31'}"
    
    return {
        "type": "date_range_picker",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "date",
            "current_operator": operator,
            "current_value": current_value,
            "format": "YYYY-MM-DD",
            "display_format": "MMM DD, YYYY",
            "picker_mode": "date",
            "allow_time": False,
            "validation": {
                "start_required": True,
                "end_required": True,
                "start_before_end": True
            }
        },
        "operator_options": [
            {"value": "before", "label": "before", "requires": "single_date"},
            {"value": "after", "label": "after", "requires": "single_date"},
            {"value": "between", "label": "between", "requires": "date_range"},
            {"value": "on", "label": "on", "requires": "single_date"}
        ]
    }


def _generate_toggle_component(
    field_info: Dict,
    unique_values: List[str],
    table_field: str
) -> Dict[str, Any]:
    """Generate Toggle/Switch configuration for boolean fields"""
    # Determine true/false labels from unique values
    on_label = "Yes"
    off_label = "No"
    
    if len(unique_values) == 2:
        # Try to intelligently determine which is "true"
        val1, val2 = unique_values[0].lower(), unique_values[1].lower()
        if val1 in ['yes', 'true', '1', 'y']:
            on_label, off_label = unique_values[0], unique_values[1]
        elif val2 in ['yes', 'true', '1', 'y']:
            on_label, off_label = unique_values[1], unique_values[0]
    
    return {
        "type": "toggle",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "boolean",
            "current_value": True,
            "on_label": on_label,
            "off_label": off_label,
            "on_value": True,
            "off_value": False,
            "default_value": None,
            "allow_null": True,
            "null_label": "Any",
            "description": field_info.get('field_description', '')
        },
        "operator_options": [
            {"value": "is_true", "label": on_label, "sql": "= TRUE"},
            {"value": "is_false", "label": off_label, "sql": "= FALSE"},
            {"value": "any", "label": "Any", "sql": "IS NOT NULL"}
        ]
    }


def _generate_checkbox_list_component(
    field_info: Dict,
    unique_values: List[str],
    table_field: str,
    mapped_concept: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Generate Checkbox List configuration for low cardinality fields
    
    Args:
        mapped_concept: Pre-selected values from the agent to pre-check in the UI
    """
    # Build a set of values to include in options
    # Start with unique values, but prioritize mapped_concepts
    values_to_show = list(unique_values[:8])  # Default: first 8 values
    
    # If we have mapped concepts, ensure they are included in options
    if mapped_concept:
        # Create case-insensitive lookup for unique_values
        unique_values_lower = {v.lower(): v for v in unique_values}
        
        for concept in mapped_concept:
            # Find the actual value (with correct casing)
            actual_value = None
            if concept in unique_values:
                actual_value = concept
            elif concept.lower() in unique_values_lower:
                actual_value = unique_values_lower[concept.lower()]
            
            # Add to values_to_show if not already present
            if actual_value and actual_value not in values_to_show:
                values_to_show.insert(0, actual_value)  # Prioritize at top
        
        # Trim back to 8 if needed
        values_to_show = values_to_show[:8]
    
    options = []
    for value in values_to_show:
        options.append({
            "value": value,
            "label": value,
            "description": f"Include {value}",
            "disabled": False
        })
    
    # Use mapped_concept as pre-selected values if available
    selected_values = []
    if mapped_concept:
        # mapped_concept can be a list of concepts - filter to only those in options
        # Use case-insensitive matching since agent might return different casing
        option_values = {opt["value"] for opt in options}
        option_values_lower = {v.lower(): v for v in option_values}
        
        for concept in mapped_concept:
            # Try exact match first
            if concept in option_values:
                selected_values.append(concept)
            # Then try case-insensitive match
            elif concept.lower() in option_values_lower:
                selected_values.append(option_values_lower[concept.lower()])
        
        logger.info(f"Pre-selecting values for {table_field}: mapped_concept={mapped_concept}, options={list(option_values)}, selected={selected_values}")
    
    return {
        "type": "checkbox_list",
        "config": {
            "field": table_field,
            "label": table_field,
            "data_type": "string",
            "selected_values": selected_values,  # Pre-selected values from agent
            "current_values": selected_values,   # Keep for backwards compatibility
            "layout": "vertical",
            "allow_select_all": True,
            "min_selections": 0,
            "max_selections": None,
            "options": options,
            "show_counts": False,
            "show_percentages": False,
            "metadata": {
                "total_unique": len(unique_values),
                "field_description": field_info.get('field_description', '')
            }
        },
        "operator_options": [
            {"value": "in", "label": "is any of", "requires": "multiple_values"},
            {"value": "not_in", "label": "is none of", "requires": "multiple_values"}
        ]
    }
