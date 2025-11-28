
import React, { useState } from 'react';
import { useFilters } from '@/app/contexts/FilterContext';
import { ChevronDown, ChevronRight, Filter as FilterIcon, Search, X } from 'lucide-react';
import { getTableNames, getFilterableFields, getFieldUniqueValues, SchemaField } from '@/app/lib/schemaHelper';


interface FilterField {
  tableName: string;
  fieldName: string;
  field: SchemaField;
  displayName: string;
}

interface FilterDropdownPanelProps {
  projectId?: string;
}

export default function FilterDropdownPanel({ projectId }: FilterDropdownPanelProps) {
  const { filters, addFilters } = useFilters();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [searchTerms, setSearchTerms] = useState<Map<string, string>>(new Map());
  const [showMoreFields, setShowMoreFields] = useState<Set<string>>(new Set());

  // State for input values
  const [intInputs, setIntInputs] = useState<Map<string, { min: string; max: string }>>(new Map());
  const [floatInputs, setFloatInputs] = useState<Map<string, { min: string; max: string }>>(new Map());
  const [selectedValues, setSelectedValues] = useState<Map<string, Set<string>>>(new Map());

  // Get all filterable fields organized by table
  const tableFields: Array<{ tableName: string; fields: FilterField[] }> = React.useMemo(() => {
    const tableNames = getTableNames();
    
    return tableNames.map(tableName => ({
      tableName,
      fields: getFilterableFields(tableName).map(({ fieldName, field }) => ({
        tableName,
        fieldName,
        field,
        displayName: fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      })),
    })).filter(t => t.fields.length > 0);
  }, []);

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  };

  const toggleField = (key: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getFieldKey = (tableName: string, fieldName: string) => `${tableName}.${fieldName}`;

  const updateSearchTerm = (key: string, term: string) => {
    setSearchTerms(prev => new Map(prev).set(key, term));
  };

  const toggleShowMore = (key: string) => {
    setShowMoreFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Handle value selection for dropdowns
  const toggleValueSelection = (key: string, value: string) => {
    setSelectedValues(prev => {
      const newMap = new Map(prev);
      const currentSet = newMap.get(key) || new Set();
      const newSet = new Set(currentSet);
      
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      
      newMap.set(key, newSet);
      return newMap;
    });
  };

  // Apply filter for a field
  const applyFieldFilter = (filterField: FilterField) => {
    const key = getFieldKey(filterField.tableName, filterField.fieldName);
    const dataType = filterField.field.field_data_type;

    if (dataType === 'object') {
      // Apply dropdown selections
      const selected = selectedValues.get(key);
      if (!selected || selected.size === 0) return;

      const newFilters = Array.from(selected).map(value => ({
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'include' as const,
        text: `${filterField.fieldName} is ${value}`,
        entities: [value.toLowerCase()],
        db_mappings: {
          [value.toLowerCase()]: {
            entity_class: 'attribute',
            'table.field': `${filterField.tableName}.${filterField.fieldName}`,
            ranked_matches: [value],
            mapped_concept: value,
            mapping_method: 'direct',
            reason: null,
            top_candidates: [value],
          },
        },
        revised_criterion: `${filterField.tableName}.${filterField.fieldName} = '${value}'`,
        enabled: true,
        affectedCount: 0,
      }));

      addFilters(newFilters);
      // Clear selection after applying
      setSelectedValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    } else if (dataType === 'int64') {
      // Apply int range filter
      const input = intInputs.get(key);
      if (!input || (input.min === '' && input.max === '')) return;

      const minVal = input.min !== '' ? parseInt(input.min) : undefined;
      const maxVal = input.max !== '' ? parseInt(input.max) : undefined;

      let criterion = '';
      let text = '';
      
      if (minVal !== undefined && maxVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} BETWEEN ${minVal} AND ${maxVal}`;
        text = `${filterField.fieldName} between ${minVal} and ${maxVal}`;
      } else if (minVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} >= ${minVal}`;
        text = `${filterField.fieldName} >= ${minVal}`;
      } else if (maxVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} <= ${maxVal}`;
        text = `${filterField.fieldName} <= ${maxVal}`;
      }

      const newFilter = {
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'include' as const,
        text,
        entities: [filterField.fieldName],
        db_mappings: {
          [filterField.fieldName]: {
            entity_class: 'numeric',
            'table.field': `${filterField.tableName}.${filterField.fieldName}`,
            ranked_matches: [],
            mapped_concept: criterion,
            mapping_method: 'range',
            reason: null,
            top_candidates: [],
          },
        },
        revised_criterion: criterion,
        enabled: true,
        affectedCount: 0,
      };

      addFilters([newFilter]);
      // Clear inputs
      setIntInputs(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    } else if (dataType === 'float64') {
      // Apply float range filter
      const input = floatInputs.get(key);
      if (!input || (input.min === '' && input.max === '')) return;

      const minVal = input.min !== '' ? parseFloat(input.min) : undefined;
      const maxVal = input.max !== '' ? parseFloat(input.max) : undefined;

      let criterion = '';
      let text = '';
      
      if (minVal !== undefined && maxVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} BETWEEN ${minVal} AND ${maxVal}`;
        text = `${filterField.fieldName} between ${minVal} and ${maxVal}`;
      } else if (minVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} >= ${minVal}`;
        text = `${filterField.fieldName} >= ${minVal}`;
      } else if (maxVal !== undefined) {
        criterion = `${filterField.tableName}.${filterField.fieldName} <= ${maxVal}`;
        text = `${filterField.fieldName} <= ${maxVal}`;
      }

      const newFilter = {
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'include' as const,
        text,
        entities: [filterField.fieldName],
        db_mappings: {
          [filterField.fieldName]: {
            entity_class: 'numeric',
            'table.field': `${filterField.tableName}.${filterField.fieldName}`,
            ranked_matches: [],
            mapped_concept: criterion,
            mapping_method: 'range',
            reason: null,
            top_candidates: [],
          },
        },
        revised_criterion: criterion,
        enabled: true,
        affectedCount: 0,
      };

      addFilters([newFilter]);
      // Clear inputs
      setFloatInputs(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
    }
  };

  // Render field UI based on data type
  const renderFieldInput = (filterField: FilterField) => {
    const key = getFieldKey(filterField.tableName, filterField.fieldName);
    const dataType = filterField.field.field_data_type;
    const searchTerm = searchTerms.get(key) || '';
    const showMore = showMoreFields.has(key);

    if (dataType === 'object') {
      // Dropdown with searchable values
      const uniqueValues = getFieldUniqueValues(filterField.tableName, filterField.fieldName);
      const hasUniqueValues = Array.isArray(filterField.field.field_unique_values);
      const valuesToShow = hasUniqueValues ? uniqueValues : filterField.field.field_sample_values;
      
      // Filter by search term
      const filteredValues = valuesToShow.filter((val: any) =>
        val.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );

      const displayLimit = showMore ? filteredValues.length : Math.min(5, filteredValues.length);
      const displayValues = filteredValues.slice(0, displayLimit);
      const hasMore = filteredValues.length > displayLimit;

      const selected = selectedValues.get(key) || new Set();

      return (
        <div className="space-y-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2 top-2 w-4 h-4" style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Search values..."
              value={searchTerm}
              onChange={e => updateSearchTerm(key, e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded"
              style={{ borderColor: '#6B7280', color: '#111827' }}
            />
          </div>

          {/* Values list */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {displayValues.map((value: any, idx: number) => (
              <label
                key={idx}
                className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors bg-white hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(value.toString())}
                  onChange={() => toggleValueSelection(key, value.toString())}
                  className="cursor-pointer"
                  style={{ accentColor: '#06B6D4' }}
                />
                <span className="text-sm" style={{ color: '#111827' }}>
                  {value.toString()}
                </span>
              </label>
            ))}
          </div>

          {/* Show more button */}
          {hasMore && (
            <button
              onClick={() => toggleShowMore(key)}
              className="text-xs px-2 py-1 rounded transition-colors w-full"
              style={{ color: '#06B6D4', backgroundColor: '#06B6D410' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#06B6D420')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#06B6D410')}
            >
              {showMore ? 'Show less' : `Show more (${filteredValues.length - displayLimit} more)`}
            </button>
          )}

          {!hasUniqueValues && (
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Showing sample values. Use search for more options.
            </p>
          )}

          {/* Apply button */}
          {selected.size > 0 && (
            <button
              onClick={() => applyFieldFilter(filterField)}
              className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
              style={{ backgroundColor: '#06B6D4', color: 'white' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a9090')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#06B6D4')}
            >
              Apply ({selected.size} selected)
            </button>
          )}
        </div>
      );
    } else if (dataType === 'int64') {
      // Integer number input with min/max
      const input = intInputs.get(key) || { min: '', max: '' };
      const samples = filterField.field.field_sample_values;
      const min = samples && samples.length > 0 ? Math.min(...samples) : undefined;
      const max = samples && samples.length > 0 ? Math.max(...samples) : undefined;

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>
                Min
              </label>
              <input
                type="number"
                placeholder={min !== undefined ? `e.g. ${min}` : 'Min'}
                value={input.min}
                onChange={e =>
                  setIntInputs(prev => new Map(prev).set(key, { ...input, min: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>
                Max
              </label>
              <input
                type="number"
                placeholder={max !== undefined ? `e.g. ${max}` : 'Max'}
                value={input.max}
                onChange={e =>
                  setIntInputs(prev => new Map(prev).set(key, { ...input, max: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
          </div>

          {min !== undefined && max !== undefined && (
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Range: {min} - {max}
            </p>
          )}

          {(input.min !== '' || input.max !== '') && (
            <button
              onClick={() => applyFieldFilter(filterField)}
              className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
              style={{ backgroundColor: '#06B6D4', color: 'white' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a9090')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#06B6D4')}
            >
              Apply Filter
            </button>
          )}
        </div>
      );
    } else if (dataType === 'float64') {
      // Float number input with min/max
      const input = floatInputs.get(key) || { min: '', max: '' };
      const samples = filterField.field.field_sample_values;
      const min = samples && samples.length > 0 ? Math.min(...samples) : undefined;
      const max = samples && samples.length > 0 ? Math.max(...samples) : undefined;

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>
                Min
              </label>
              <input
                type="number"
                step="any"
                placeholder={min !== undefined ? `e.g. ${min.toFixed(2)}` : 'Min'}
                value={input.min}
                onChange={e =>
                  setFloatInputs(prev => new Map(prev).set(key, { ...input, min: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>
                Max
              </label>
              <input
                type="number"
                step="any"
                placeholder={max !== undefined ? `e.g. ${max.toFixed(2)}` : 'Max'}
                value={input.max}
                onChange={e =>
                  setFloatInputs(prev => new Map(prev).set(key, { ...input, max: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
          </div>

          {min !== undefined && max !== undefined && (
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Range: {min.toFixed(2)} - {max.toFixed(2)}
            </p>
          )}

          {(input.min !== '' || input.max !== '') && (
            <button
              onClick={() => applyFieldFilter(filterField)}
              className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
              style={{ backgroundColor: '#06B6D4', color: 'white' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#5a9090')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#06B6D4')}
            >
              Apply Filter
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b p-4 z-10" style={{ borderColor: '#6B7280' }}>
        <div className="flex items-center gap-2">
          <FilterIcon className="w-5 h-5" style={{ color: '#06B6D4' }} />
          <h3 className="font-semibold" style={{ color: '#111827' }}>
            Add Filters
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
          {tableFields.length} tables with filterable fields
        </p>
      </div>

      {/* Tables and Fields */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {tableFields.map(({ tableName, fields }) => (
            <div
              key={tableName}
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: '#6B7280' }}
            >
              {/* Table Header */}
              <button
                onClick={() => toggleTable(tableName)}
                className="w-full flex items-center justify-between p-3 transition-colors bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {expandedTables.has(tableName) ? (
                    <ChevronDown className="w-5 h-5" style={{ color: '#111827' }} />
                  ) : (
                    <ChevronRight className="w-5 h-5" style={{ color: '#111827' }} />
                  )}
                  <span className="font-semibold text-sm" style={{ color: '#111827' }}>
                    {tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#6B728020', color: '#6B7280' }}
                >
                  {fields.length} fields
                </span>
              </button>

              {/* Fields */}
              {expandedTables.has(tableName) && (
                <div className="border-t" style={{ borderColor: '#6B728040' }}>
                  <div className="p-2 space-y-2">
                    {fields.map(filterField => {
                      const key = getFieldKey(filterField.tableName, filterField.fieldName);
                      const isExpanded = expandedFields.has(key);

                      return (
                        <div
                          key={key}
                          className="border rounded overflow-hidden"
                          style={{ borderColor: '#e5e7eb' }}
                        >
                          {/* Field Header */}
                          <button
                            onClick={() => toggleField(key)}
                            className="w-full flex items-center justify-between p-2 transition-colors bg-white hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3" style={{ color: '#6B7280' }} />
                              ) : (
                                <ChevronRight className="w-3 h-3" style={{ color: '#6B7280' }} />
                              )}
                              <span className="font-medium text-sm" style={{ color: '#111827' }}>
                                {filterField.displayName}
                              </span>
                            </div>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: '#6B728020',
                                color: '#6B7280',
                              }}
                            >
                              {filterField.field.field_data_type}
                            </span>
                          </button>

                          {/* Field Input */}
                          {isExpanded && (
                            <div className="bg-gray-50 border-t p-3" style={{ borderColor: '#e5e7eb' }}>
                              {renderFieldInput(filterField)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
