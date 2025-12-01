'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useFilters } from '@/app/contexts/FilterContext';
import { useFieldMappings } from '@/app/contexts/FieldMappingContext';
import { ChevronDown, ChevronRight, Filter as FilterIcon, Search, Loader2, Check, Sparkles } from 'lucide-react';
import {
  fetchProjectTables,
  fetchTableFields,
  fetchFieldValues,
  createFieldMapping,
  TableInfo,
  FieldInfo,
} from '@/app/lib/fieldMappingService';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Helper to get CSRF token
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

interface FilterDropdownPanelProps {
  projectId?: number;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function FilterDropdownPanel({ projectId, isCollapsed: externalCollapsed, onCollapseChange }: FilterDropdownPanelProps) {
  const { filters, addFilters } = useFilters();
  const { fieldMappings, getAgentMappings, getConfirmedMappings, refreshMappings, deleteFieldMapping } = useFieldMappings();
  
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  // Use external collapse state if provided, otherwise use internal state
  const isSectionCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  
  const handleCollapseToggle = () => {
    const newCollapsed = !isSectionCollapsed;
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  };
  
  // State for lazy-loaded data
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableFields, setTableFields] = useState<Map<string, FieldInfo[]>>(new Map());
  const [fieldValues, setFieldValues] = useState<Map<string, any[]>>(new Map());
  
  // Loading states
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());
  const [loadingValues, setLoadingValues] = useState<Set<string>>(new Set());
  
  // UI states
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [searchTerms, setSearchTerms] = useState<Map<string, string>>(new Map());
  const [showMoreFields, setShowMoreFields] = useState<Set<string>>(new Set());
  
  // Input states
  const [intInputs, setIntInputs] = useState<Map<string, { min: string; max: string }>>(new Map());
  const [floatInputs, setFloatInputs] = useState<Map<string, { min: string; max: string }>>(new Map());
  const [selectedValues, setSelectedValues] = useState<Map<string, Set<string>>>(new Map());

  // Load tables on mount
  useEffect(() => {
    if (projectId) {
      loadTables();
    }
  }, [projectId]);


  const loadTables = async () => {
    if (!projectId) return;
    
    setLoadingTables(true);
    try {
      const tableList = await fetchProjectTables(projectId);
      setTables(tableList);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadTableFields = async (tableName: string) => {
    if (!projectId || tableFields.has(tableName)) return;
    
    setLoadingFields(prev => new Set(prev).add(tableName));
    try {
      const fields = await fetchTableFields(projectId, tableName);
      // Filter out ID fields and 100% unique fields
      const filterableFields = fields.filter(
        field =>
          !field.field_name.toLowerCase().includes('_id') &&
          field.field_name.toLowerCase() !== 'id' &&
          field.field_uniqueness_percent < 100
      );
      setTableFields(prev => new Map(prev).set(tableName, filterableFields));
    } catch (error) {
      console.error('Failed to load fields:', error);
    } finally {
      setLoadingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

  const loadFieldValues = async (tableName: string, fieldName: string) => {
    if (!projectId) return;
    
    const key = getFieldKey(tableName, fieldName);
    if (fieldValues.has(key)) return;
    
    setLoadingValues(prev => new Set(prev).add(key));
    try {
      const result = await fetchFieldValues(projectId, tableName, fieldName, 100);
      // Handle both array of values or array of objects with value property
      // Ensure we always get an array from the response
      let values = [];
      if (result && typeof result === 'object') {
        if (Array.isArray(result.values)) {
          values = result.values;
        } else if (Array.isArray(result)) {
          values = result;
        }
      }
      // Ensure values is always an array
      const valuesArray = Array.isArray(values) ? values : [];
      setFieldValues(prev => new Map(prev).set(key, valuesArray));
    } catch (error) {
      console.error('Failed to load field values:', error);
    } finally {
      setLoadingValues(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
        // Lazy load fields when table is expanded
        loadTableFields(tableName);
      }
      return newSet;
    });
  };

  const toggleField = (tableName: string, fieldName: string, fieldType: string) => {
    const key = getFieldKey(tableName, fieldName);
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
        // Lazy load values for object type fields when expanded
        if (fieldType === 'object') {
          loadFieldValues(tableName, fieldName);
        }
        // Initialize selected values from existing field mappings
        initializeSelectedValuesFromMappings(tableName, fieldName);
      }
      return newSet;
    });
  };

  // Initialize selected values based on existing field mappings (both user and agent created)
  const initializeSelectedValuesFromMappings = useCallback((tableName: string, fieldName: string, fieldType?: string) => {
    const key = getFieldKey(tableName, fieldName);
    // Check ALL field mappings regardless of source (user or agent)
    const existingMappings = fieldMappings.filter(
      m => m.table_name === tableName && m.field_name === fieldName
    );

    if (existingMappings.length > 0) {
      const mapping = existingMappings[0]; // Use the most recent mapping
      
      // Handle object type fields (checkboxes)
      if (fieldType === 'object' || !fieldType || mapping.field_type === 'object') {
        const appliedValues = new Set<string>();
        existingMappings.forEach(m => {
          if (Array.isArray(m.value)) {
            m.value.forEach((v: any) => appliedValues.add(v.toString()));
          } else if (m.value !== null && m.value !== undefined) {
            appliedValues.add(m.value.toString());
          }
        });
        
        if (appliedValues.size > 0) {
          setSelectedValues(prev => {
            const newMap = new Map(prev);
            newMap.set(key, appliedValues);
            return newMap;
          });
        }
      }
      // Handle numeric fields (int64, float64)
      else if (fieldType === 'int64' || fieldType === 'float64' || mapping.field_type === 'int64' || mapping.field_type === 'float64') {
        const value = mapping.value;
        const operator = mapping.operator || '=';
        
        if (typeof value === 'object' && value !== null && 'min' in value && 'max' in value) {
          // BETWEEN range - put both values
          const updateInputs = (setter: React.Dispatch<React.SetStateAction<Map<string, { min: string; max: string }>>>) => {
            setter(prev => {
              const newMap = new Map(prev);
              newMap.set(key, { min: value.min.toString(), max: value.max.toString() });
              return newMap;
            });
          };
          
          if (fieldType === 'int64' || mapping.field_type === 'int64') {
            updateInputs(setIntInputs);
          } else {
            updateInputs(setFloatInputs);
          }
        } else {
          // Extract numeric value
          const numValue = typeof value === 'number' ? value : (Array.isArray(value) ? value[0] : parseFloat(value));
          
          if (!isNaN(numValue) && numValue !== null && numValue !== undefined) {
            const updateInputs = (setter: React.Dispatch<React.SetStateAction<Map<string, { min: string; max: string }>>>, minVal: string, maxVal: string) => {
              setter(prev => {
                const newMap = new Map(prev);
                newMap.set(key, { min: minVal, max: maxVal });
                return newMap;
              });
            };
            
            let minStr = '';
            let maxStr = '';
            
            // Handle different operators
            if (operator === '=' || operator === '==') {
              // Equal: put value in both boxes
              minStr = numValue.toString();
              maxStr = numValue.toString();
            } else if (operator === '>' || operator === '>=') {
              // Greater than/equal: put value in MIN box
              minStr = numValue.toString();
              maxStr = '';
            } else if (operator === '<' || operator === '<=') {
              // Less than/equal: put value in MAX box
              minStr = '';
              maxStr = numValue.toString();
            } else if (operator === 'BETWEEN' || operator.toLowerCase() === 'between') {
              // BETWEEN should have already been handled above, but just in case
              if (Array.isArray(value) && value.length === 2) {
                minStr = value[0].toString();
                maxStr = value[1].toString();
              } else {
                // Fallback to empty
                minStr = '';
                maxStr = '';
              }
            }
            
            if (fieldType === 'int64' || mapping.field_type === 'int64') {
              updateInputs(setIntInputs, minStr, maxStr);
            } else {
              updateInputs(setFloatInputs, minStr, maxStr);
            }
          }
        }
      }
    }
  }, [fieldMappings]);

  // Sync checkboxes and inputs when field mappings change (from agent or user)
  useEffect(() => {
    // Re-initialize selected values for all currently expanded fields
    expandedFields.forEach(fieldKey => {
      const [tableName, fieldName] = fieldKey.split('.');
      if (tableName && fieldName) {
        // Get field type from tableFields if available
        const fields = tableFields.get(tableName) || [];
        const fieldInfo = fields.find(f => f.field_name === fieldName);
        const fieldType = fieldInfo?.field_type;
        initializeSelectedValuesFromMappings(tableName, fieldName, fieldType);
      }
    });
  }, [fieldMappings, expandedFields, initializeSelectedValuesFromMappings, tableFields]);

  const getFieldKey = (tableName: string, fieldName: string) => `${tableName}.${fieldName}`;

  // Send filter update to agent to update criteria
  const sendFilterUpdateToAgent = async (
    tableName: string,
    fieldName: string,
    fieldType: string,
    value: any,
    operator: string,
    sqlCriterion: string
  ) => {
    if (!projectId) return;

    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      // Format the filter as a natural language message for the agent
      let filterMessage = '';
      if (fieldType === 'object') {
        const values = Array.isArray(value) ? value : [value];
        filterMessage = `Apply filter: ${fieldName} ${operator === 'IN' ? 'is one of' : 'is'} ${values.join(', ')}`;
      } else if (fieldType === 'int64' || fieldType === 'float64') {
        if (operator === 'BETWEEN' && typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          filterMessage = `Apply filter: ${fieldName} is between ${value.min} and ${value.max}`;
        } else if (operator === '>=') {
          filterMessage = `Apply filter: ${fieldName} is at least ${value}`;
        } else if (operator === '<=') {
          filterMessage = `Apply filter: ${fieldName} is at most ${value}`;
        } else {
          filterMessage = `Apply filter: ${fieldName} ${operator} ${value}`;
        }
      }

      // Get all current field mappings to send to agent
      const allMappings = fieldMappings.map(m => ({
        table_name: m.table_name,
        field_name: m.field_name,
        field_type: m.field_type,
        concept: m.concept,
        operator: m.operator,
        value: m.value,
        sql_criterion: m.sql_criterion,
        display_text: m.display_text,
        source: m.source,
        status: m.status,
      }));

      // Send to agent
      const response = await fetch(`${API_URL}/chat/conversational`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          project_id: projectId,
          message: filterMessage,
          field_mappings: allMappings, // Send all current mappings
        }),
      });

      if (!response.ok) {
        console.error('Failed to send filter update to agent:', response.status);
      }
    } catch (error) {
      console.error('Error sending filter update to agent:', error);
      // Don't throw - filter is still saved, just agent sync failed
    }
  };

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

  const applyFieldFilter = async (tableName: string, fieldName: string, fieldType: string) => {
    if (!projectId) return;
    
    const key = getFieldKey(tableName, fieldName);
    
    if (fieldType === 'object') {
      const selected = selectedValues.get(key) || new Set();
      const values = Array.from(selected);

      // If nothing is selected, remove existing mappings for this field
      if (values.length === 0) {
        try {
          // Find and delete all existing mappings for this field
          const existingMappings = fieldMappings.filter(
            m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
          );
          
          for (const mapping of existingMappings) {
            await deleteFieldMapping(projectId, mapping.id);
          }
          
          await refreshMappings();
          return;
        } catch (error) {
          console.error('Failed to remove filter:', error);
          return;
        }
      }

      const concept = `${fieldName} is ${values.join(' or ')}`;
      const operator = values.length > 1 ? 'IN' : '=';
      const sqlCriterion =
        values.length > 1
          ? `${tableName}.${fieldName} IN (${values.map(v => `'${v}'`).join(', ')})`
          : `${tableName}.${fieldName} = '${values[0]}'`;
      const displayText = `${fieldName}: ${values.join(', ')}`;

      try {
        // Delete existing mappings for this field first (to replace them)
        const existingMappings = fieldMappings.filter(
          m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
        );
        
        for (const mapping of existingMappings) {
          await deleteFieldMapping(projectId, mapping.id);
        }

        // Save new field mapping
        await createFieldMapping(projectId, {
          table_name: tableName,
          field_name: fieldName,
          field_type: fieldType,
          concept,
          operator,
          value: values.length === 1 ? values[0] : values,
          sql_criterion: sqlCriterion,
          display_text: displayText,
          source: 'user',
          status: 'draft',
        });

        // Refresh mappings to get the latest state
        await refreshMappings();

        // Send filter update to agent
        await sendFilterUpdateToAgent(tableName, fieldName, fieldType, values, operator, sqlCriterion);

        // Also add to legacy filter context for backward compatibility
        const newFilters = values.map(value => ({
          id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'include' as const,
          text: `${fieldName} is ${value}`,
          entities: [value.toLowerCase()],
          db_mappings: {
            [value.toLowerCase()]: {
              entity_class: 'attribute',
              'table.field': `${tableName}.${fieldName}`,
              ranked_matches: [value],
              mapped_concept: value,
              mapping_method: 'direct',
              reason: null,
              top_candidates: [value],
            },
          },
          revised_criterion: `${tableName}.${fieldName} = '${value}'`,
          enabled: true,
          affectedCount: 0,
        }));
        addFilters(newFilters);

        // Keep the selection checked - don't clear it
        // The checkboxes should remain checked to show they're applied
      } catch (error) {
        console.error('Failed to apply filter:', error);
      }
    } else if (fieldType === 'int64') {
      const input = intInputs.get(key) || { min: '', max: '' };
      
      // If both inputs are empty, remove existing mappings
      if (input.min === '' && input.max === '') {
        try {
          const existingMappings = fieldMappings.filter(
            m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
          );
          
          for (const mapping of existingMappings) {
            await deleteFieldMapping(projectId, mapping.id);
          }
          
          await refreshMappings();
          return;
        } catch (error) {
          console.error('Failed to remove filter:', error);
          return;
        }
      }

      const minVal = input.min !== '' ? parseInt(input.min) : undefined;
      const maxVal = input.max !== '' ? parseInt(input.max) : undefined;

      let criterion = '';
      let text = '';
      let operator = '';
      let value: any;

      if (minVal !== undefined && maxVal !== undefined) {
        criterion = `${tableName}.${fieldName} BETWEEN ${minVal} AND ${maxVal}`;
        text = `${fieldName} between ${minVal} and ${maxVal}`;
        operator = 'BETWEEN';
        value = { min: minVal, max: maxVal };
      } else if (minVal !== undefined) {
        criterion = `${tableName}.${fieldName} >= ${minVal}`;
        text = `${fieldName} >= ${minVal}`;
        operator = '>=';
        value = minVal;
      } else if (maxVal !== undefined) {
        criterion = `${tableName}.${fieldName} <= ${maxVal}`;
        text = `${fieldName} <= ${maxVal}`;
        operator = '<=';
        value = maxVal;
      }

      try {
        // Delete existing mappings for this field first (to replace them)
        const existingMappings = fieldMappings.filter(
          m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
        );
        
        for (const mapping of existingMappings) {
          await deleteFieldMapping(projectId, mapping.id);
        }

        await createFieldMapping(projectId, {
          table_name: tableName,
          field_name: fieldName,
          field_type: fieldType,
          concept: text,
          operator,
          value,
          sql_criterion: criterion,
          display_text: text,
          source: 'user',
          status: 'draft',
        });

        // Refresh mappings to get the latest state
        await refreshMappings();

        // Send filter update to agent
        await sendFilterUpdateToAgent(tableName, fieldName, fieldType, value, operator, criterion);

        // Add to legacy context
        const newFilter = {
          id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'include' as const,
          text,
          entities: [fieldName],
          db_mappings: {
            [fieldName]: {
              entity_class: 'numeric',
              'table.field': `${tableName}.${fieldName}`,
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

        // Keep the input values to show they're applied (don't clear)
        // Optionally, you could add a visual indicator instead
      } catch (error) {
        console.error('Failed to apply filter:', error);
      }
    } else if (fieldType === 'float64') {
      const input = floatInputs.get(key) || { min: '', max: '' };
      
      // If both inputs are empty, remove existing mappings
      if (input.min === '' && input.max === '') {
        try {
          const existingMappings = fieldMappings.filter(
            m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
          );
          
          for (const mapping of existingMappings) {
            await deleteFieldMapping(projectId, mapping.id);
          }
          
          await refreshMappings();
          return;
        } catch (error) {
          console.error('Failed to remove filter:', error);
          return;
        }
      }

      const minVal = input.min !== '' ? parseFloat(input.min) : undefined;
      const maxVal = input.max !== '' ? parseFloat(input.max) : undefined;

      let criterion = '';
      let text = '';
      let operator = '';
      let value: any;

      if (minVal !== undefined && maxVal !== undefined) {
        criterion = `${tableName}.${fieldName} BETWEEN ${minVal} AND ${maxVal}`;
        text = `${fieldName} between ${minVal} and ${maxVal}`;
        operator = 'BETWEEN';
        value = { min: minVal, max: maxVal };
      } else if (minVal !== undefined) {
        criterion = `${tableName}.${fieldName} >= ${minVal}`;
        text = `${fieldName} >= ${minVal}`;
        operator = '>=';
        value = minVal;
      } else if (maxVal !== undefined) {
        criterion = `${tableName}.${fieldName} <= ${maxVal}`;
        text = `${fieldName} <= ${maxVal}`;
        operator = '<=';
        value = maxVal;
      }

      try {
        // Delete existing mappings for this field first (to replace them)
        const existingMappings = fieldMappings.filter(
          m => m.table_name === tableName && m.field_name === fieldName && m.source === 'user'
        );
        
        for (const mapping of existingMappings) {
          await deleteFieldMapping(projectId, mapping.id);
        }

        await createFieldMapping(projectId, {
          table_name: tableName,
          field_name: fieldName,
          field_type: fieldType,
          concept: text,
          operator,
          value,
          sql_criterion: criterion,
          display_text: text,
          source: 'user',
          status: 'draft',
        });

        // Refresh mappings to get the latest state
        await refreshMappings();

        // Send filter update to agent
        await sendFilterUpdateToAgent(tableName, fieldName, fieldType, value, operator, criterion);

        const newFilter = {
          id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'include' as const,
          text,
          entities: [fieldName],
          db_mappings: {
            [fieldName]: {
              entity_class: 'numeric',
              'table.field': `${tableName}.${fieldName}`,
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

        // Keep the input values to show they're applied (don't clear)
        // Optionally, you could add a visual indicator instead
      } catch (error) {
        console.error('Failed to apply filter:', error);
      }
    }
  };

  const renderFieldInput = (tableName: string, fieldName: string, fieldType: string) => {
    const key = getFieldKey(tableName, fieldName);
    const searchTerm = searchTerms.get(key) || '';
    const showMore = showMoreFields.has(key);
    const isLoadingValues = loadingValues.has(key);

    if (fieldType === 'object') {
      const values = fieldValues.get(key);
      const valuesArray = Array.isArray(values) ? values : [];
      const filteredValues = valuesArray.filter((val: any) =>
        val.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );

      const displayLimit = showMore ? filteredValues.length : Math.min(5, filteredValues.length);
      const displayValues = filteredValues.slice(0, displayLimit);
      const hasMore = filteredValues.length > displayLimit;
      const selected = selectedValues.get(key) || new Set();

      return (
        <div className="space-y-2">
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

          {isLoadingValues ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#8E42EE' }} />
            </div>
          ) : (
            <>
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
                      style={{ accentColor: '#8E42EE' }}
                    />
                    <span className="text-sm" style={{ color: '#111827' }}>
                      {value.toString()}
                    </span>
                  </label>
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={() => toggleShowMore(key)}
                  className="text-xs px-2 py-1 rounded transition-colors w-full"
                  style={{ color: '#8E42EE', backgroundColor: '#8E42EE10' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#8E42EE20')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8E42EE10')}
                >
                  {showMore ? 'Show less' : `Show more (${filteredValues.length - displayLimit} more)`}
                </button>
              )}

              <button
                onClick={() => applyFieldFilter(tableName, fieldName, fieldType)}
                className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
                style={{ 
                  backgroundColor: selected.size > 0 ? '#8E42EE' : '#6B7280', 
                  color: 'white' 
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = selected.size > 0 ? '#6A42EE' : '#4B5563'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = selected.size > 0 ? '#8E42EE' : '#6B7280'}
              >
                {selected.size > 0 
                  ? `Apply (${selected.size} selected)` 
                  : 'Remove Filter'}
              </button>
            </>
          )}
        </div>
      );
    } else if (fieldType === 'int64') {
      const input = intInputs.get(key) || { min: '', max: '' };

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>
                Min
              </label>
              <input
                type="number"
                placeholder="Min"
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
                placeholder="Max"
                value={input.max}
                onChange={e =>
                  setIntInputs(prev => new Map(prev).set(key, { ...input, max: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
          </div>

          <button
            onClick={() => applyFieldFilter(tableName, fieldName, fieldType)}
            className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
            style={{ 
              backgroundColor: (input.min !== '' || input.max !== '') ? '#8E42EE' : '#6B7280', 
              color: 'white' 
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = (input.min !== '' || input.max !== '') ? '#6A42EE' : '#4B5563'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = (input.min !== '' || input.max !== '') ? '#8E42EE' : '#6B7280'}
          >
            {(input.min !== '' || input.max !== '') ? 'Apply Filter' : 'Remove Filter'}
          </button>
        </div>
      );
    } else if (fieldType === 'float64') {
      const input = floatInputs.get(key) || { min: '', max: '' };

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
                placeholder="Min"
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
                placeholder="Max"
                value={input.max}
                onChange={e =>
                  setFloatInputs(prev => new Map(prev).set(key, { ...input, max: e.target.value }))
                }
                className="w-full px-2 py-1.5 text-sm border rounded"
                style={{ borderColor: '#6B7280', color: '#111827' }}
              />
            </div>
          </div>

          <button
            onClick={() => applyFieldFilter(tableName, fieldName, fieldType)}
            className="w-full px-3 py-2 rounded font-medium text-sm transition-colors"
            style={{ 
              backgroundColor: (input.min !== '' || input.max !== '') ? '#8E42EE' : '#6B7280', 
              color: 'white' 
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = (input.min !== '' || input.max !== '') ? '#6A42EE' : '#4B5563'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = (input.min !== '' || input.max !== '') ? '#8E42EE' : '#6B7280'}
          >
            {(input.min !== '' || input.max !== '') ? 'Apply Filter' : 'Remove Filter'}
          </button>
        </div>
      );
    }

    return null;
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <FilterIcon className="w-12 h-12 mb-3" style={{ color: '#D1D5DB' }} />
        <p className="text-sm text-center" style={{ color: '#6B7280' }}>
          No project selected. Filters will appear here when you select a project.
        </p>
      </div>
    );
  }

  // Get agent-confirmed mappings
  const agentMappings = getAgentMappings();
  const confirmedMappings = getConfirmedMappings();

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <button
          onClick={handleCollapseToggle}
          className="w-full flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            {isSectionCollapsed ? (
              <ChevronRight className="w-4 h-4" style={{ color: '#6B7280' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: '#6B7280' }} />
            )}
            <FilterIcon className="w-5 h-5" style={{ color: '#8E42EE' }} />
            <h3 className="font-semibold" style={{ color: '#111827' }}>
              Add Filters
            </h3>
          </div>
        </button>
        {!isSectionCollapsed && (
          <>
            {loadingTables ? (
              <p className="text-xs mt-1 ml-6" style={{ color: '#6B7280' }}>
                Loading tables...
              </p>
            ) : (
              <p className="text-xs mt-1 ml-6" style={{ color: '#6B7280' }}>
                {tables.length} tables available
              </p>
            )}
          </>
        )}
      </div>

      {!isSectionCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
        {/* Agent-finalized mappings section */}
        {confirmedMappings.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" style={{ color: '#8E42EE' }} />
              <h4 className="text-sm font-semibold" style={{ color: '#8E42EE' }}>
                Agent-Confirmed Filters
              </h4>
            </div>
            <div className="space-y-2">
              {confirmedMappings.map(mapping => (
                <div
                  key={mapping.id}
                  className="p-3 rounded-lg border"
                  style={{
                    backgroundColor: '#F5F0FB',
                    borderColor: '#E8DDFF',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#8E42EE' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>
                        {mapping.display_text}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                        {mapping.table_name}.{mapping.field_name}
                      </p>
                      {mapping.source === 'agent' && (
                        <div className="flex items-center gap-1 mt-1">
                          <Sparkles className="w-3 h-3" style={{ color: '#8E42EE' }} />
                          <span className="text-xs" style={{ color: '#8E42EE' }}>
                            Finalized by Agent
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-b border-gray-200 mt-4 mb-4" />
          </div>
        )}
        {loadingTables ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8E42EE' }} />
          </div>
        ) : (
          <div className="space-y-3">
            {tables.map(table => {
              const fields = tableFields.get(table.table_name) || [];
              const isLoadingFields = loadingFields.has(table.table_name);
              const isExpanded = expandedTables.has(table.table_name);

              return (
                <div
                  key={table.table_name}
                  className="border rounded-lg overflow-hidden"
                  style={{ borderColor: '#6B7280' }}
                >
                  <button
                    onClick={() => toggleTable(table.table_name)}
                    className="w-full flex items-center justify-between p-3 transition-colors bg-white hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" style={{ color: '#111827' }} />
                      ) : (
                        <ChevronRight className="w-5 h-5" style={{ color: '#111827' }} />
                      )}
                      <span className="font-semibold text-sm" style={{ color: '#111827' }}>
                        {table.table_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: '#6B728020', color: '#6B7280' }}
                    >
                      {table.field_count} fields
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {isLoadingFields ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8E42EE' }} />
                        </div>
                      ) : (
                        <div className="p-2 space-y-2">
                          {fields.map(field => {
                            const key = getFieldKey(table.table_name, field.field_name);
                            const isFieldExpanded = expandedFields.has(key);

                            return (
                              <div
                                key={key}
                                className="border rounded overflow-hidden"
                                style={{ borderColor: '#e5e7eb' }}
                              >
                                <button
                                  onClick={() =>
                                    toggleField(table.table_name, field.field_name, field.field_type)
                                  }
                                  className="w-full flex items-center justify-between p-2 transition-colors bg-white hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-2">
                                    {isFieldExpanded ? (
                                      <ChevronDown className="w-3 h-3" style={{ color: '#6B7280' }} />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" style={{ color: '#6B7280' }} />
                                    )}
                                    <span className="font-medium text-sm" style={{ color: '#111827' }}>
                                      {field.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                  </div>
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: '#6B728020', color: '#6B7280' }}
                                  >
                                    {field.field_type}
                                  </span>
                                </button>

                                {isFieldExpanded && (
                                  <div className="bg-gray-50 border-t border-gray-200 p-3">
                                    {renderFieldInput(table.table_name, field.field_name, field.field_type)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
