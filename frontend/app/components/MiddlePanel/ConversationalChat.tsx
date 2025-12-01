'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, User, Bot, Loader2, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { CriteriaChips, SQLPreview, QueryResults } from '@/app/components/criteria';
import DynamicCriterionComponent from '@/app/components/criteria/DynamicCriterionComponent';
import ProgressiveCriteriaLayout from './ProgressiveCriteriaLayout';
import { Button } from '@/app/components/ui';
import Tag from '@/app/components/ui/Tag';
import { useFieldMappings } from '@/app/contexts/FieldMappingContext';
import { createFieldMapping as apiCreateFieldMapping, deleteFieldMapping as apiDeleteFieldMapping } from '@/app/lib/fieldMappingService';

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

interface CohortProject {
  id: number;
  name: string;
  atlas_id: string;
  atlas_name: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ui_components?: any;
  timestamp: string;
  next_prompt?: string;
  status?: 'loading' | 'success' | 'error';
  error_message?: string;
  metadata?: {
    thinking?: string;
    tool_calls?: Array<{
      tool: string;
      description: string;
      status: 'running' | 'completed' | 'failed';
    }>;
  };
}

const SUGGESTED_PROMPTS = [
  'Show me female patients with breast cancer',
  'Find patients aged 50-70 with lung cancer',
  'Patients with diabetes and high blood pressure',
];

interface ConversationalChatProps {
  projectId?: string;
}

export default function ConversationalChat({ projectId }: ConversationalChatProps) {
  const [project, setProject] = useState<CohortProject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [criteriaValues, setCriteriaValues] = useState<{ [key: string]: any }>({});
  const [fieldMappingChanges, setFieldMappingChanges] = useState<{ [key: string]: string }>({});
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [accumulatedCriteria, setAccumulatedCriteria] = useState<any[]>([]);
  const [accumulatedFieldMappings, setAccumulatedFieldMappings] = useState<any[]>([]);
  const { refreshMappings, fieldMappings: contextMappings } = useFieldMappings();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load project from API
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoadingProject(true);
      setProjectError(null);
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_URL}/cohort-projects/${projectId}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const projectData = await response.json();
        setProject(projectData);
        setProjectError(null);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Failed to load project:', response.status, errorData);
        setProjectError(errorData.detail || `Failed to load project (${response.status})`);
      }
    } catch (error: any) {
      console.error('Error loading project:', error);
      setProjectError(error.message || 'Failed to connect to server');
    } finally {
      setLoadingProject(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId, loadProject]);

  // Load chat history when project loads
  useEffect(() => {
    if (!project) return;

    const loadHistory = async () => {
      try {
        const csrfToken = getCookie('csrftoken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (csrfToken) {
          headers['X-CSRFToken'] = csrfToken;
        }

        const response = await fetch(`${API_URL}/chat/history/${project.id}?limit=100`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          
          // Convert history to chat messages
          const chatMessages: ChatMessage[] = data.messages.reverse().map((msg: any) => {
            // Extract ui_components from various possible locations
            // Check direct property first, then metadata
            let uiComponents = msg.ui_components;
            if (!uiComponents && msg.metadata) {
              uiComponents = msg.metadata.ui_components || msg.metadata.metadata?.ui_components;
            }
            
            // Extract stage from various locations
            const stage = msg.stage !== undefined 
              ? msg.stage 
              : msg.metadata?.stage !== undefined
                ? msg.metadata.stage
                : msg.metadata?.metadata?.stage !== undefined
                  ? msg.metadata.metadata.stage
                  : 0;
            
            // Build metadata object with all nested data
            const metadata = {
              ...(msg.metadata || {}),
              // Ensure we have criteria if it exists in nested metadata
              criteria: msg.metadata?.criteria || msg.metadata?.metadata?.criteria,
              fieldMappings: msg.metadata?.fieldMappings || msg.metadata?.metadata?.fieldMappings,
              stage: stage,
            };
            
            return {
              id: msg.id.toString(),
              role: msg.role,
              content: msg.content,
              ui_components: uiComponents,
              timestamp: msg.created_at,
              stage: stage,
              status: 'success',
              metadata: metadata,
              next_prompt: msg.metadata?.next_prompt || msg.metadata?.metadata?.next_prompt,
            };
          });
          
          // After loading history, update accumulated data from the last assistant message
          const lastAssistantMessage = chatMessages.filter(m => m.role === 'assistant').pop();
          if (lastAssistantMessage) {
            const criteria = lastAssistantMessage.metadata?.criteria;
            const fieldMappings = lastAssistantMessage.metadata?.fieldMappings;
            const stage = lastAssistantMessage.metadata?.stage;
            
            if (criteria && criteria.length > 0) {
              setAccumulatedCriteria(criteria);
            }
            if (fieldMappings && fieldMappings.length > 0) {
              setAccumulatedFieldMappings(fieldMappings);
            }
            if (stage !== undefined) {
              setCurrentStage(stage);
            }
          }
          
          setMessages(chatMessages);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    loadHistory();
  }, [project]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !project) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Add loading message for assistant
    const loadingMsgId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessage = {
      id: loadingMsgId,
      role: 'assistant',
      content: 'Processing your request...',
      timestamp: new Date().toISOString(),
      status: 'loading'
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_URL}/chat/conversational`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Debug logging
      console.log('Received response from backend:', data);
      console.log('UI Components:', data.ui_components);
      console.log('Metadata:', data.metadata);

      // Extract stage from response
      const stage = data.stage !== undefined ? data.stage : data.metadata?.stage || currentStage;
      setCurrentStage(stage);

      // Extract and accumulate criteria, field mappings, and concept mappings
      let criteria: any[] = [];
      let fieldMappings: any[] = [];
      
      // Check if ui_components contains criteria
      if (data.ui_components) {
        if (Array.isArray(data.ui_components)) {
          data.ui_components.forEach((comp: any) => {
            if (comp.type === 'criteria_chips' || comp.type === 'criteria_form') {
              criteria = comp.data || [];
            } else if (comp.type === 'schema_mapping') {
              fieldMappings = comp.data || [];
            }
          });
        } else if (typeof data.ui_components === 'object') {
          if (data.ui_components.type === 'criteria_chips' || data.ui_components.type === 'criteria_form') {
            criteria = data.ui_components.data || [];
          } else if (data.ui_components.type === 'schema_mapping') {
            fieldMappings = data.ui_components.data || [];
          }
        }
      }

      // Also check metadata for criteria (handle nested metadata)
      if (data.metadata?.criteria) {
        criteria = data.metadata.criteria;
      } else if (data.metadata?.metadata?.criteria) {
        criteria = data.metadata.metadata.criteria;
      }
      
      // Extract field mappings from metadata if not found in ui_components
      if (fieldMappings.length === 0) {
        if (data.metadata?.fieldMappings) {
          fieldMappings = data.metadata.fieldMappings;
        } else if (data.metadata?.metadata?.fieldMappings) {
          fieldMappings = data.metadata.metadata.fieldMappings;
        }
      }

      // Update accumulated data (merge with existing, preferring newer data)
      if (criteria.length > 0) {
        setAccumulatedCriteria(criteria);
      }
      if (fieldMappings.length > 0) {
        setAccumulatedFieldMappings(fieldMappings);
      }

      // Replace loading message with actual response
      setMessages(prev => 
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: data.assistant_message_id?.toString() || `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response_text || data.response || 'Response received',
          ui_components: data.ui_components,
          timestamp: data.timestamp || new Date().toISOString(),
          next_prompt: data.next_prompt,
          status: 'success',
          metadata: { ...data.metadata, stage, criteria, fieldMappings }
        })
      );

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Replace loading message with error
      setMessages(prev => 
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: `error-${Date.now()}`,
          role: 'system',
          content: 'Sorry, I encountered an error processing your message. Please try again.',
          timestamp: new Date().toISOString(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyFieldMappings = async (originalMappings: any[]) => {
    if (!project || Object.keys(fieldMappingChanges).length === 0) return;

    setLoading(true);

    // Build updated mappings array
    const updatedMappings = originalMappings.map((mapping, idx) => {
      const changeKey = `mapping_${idx}`;
      if (fieldMappingChanges[changeKey]) {
        return {
          ...mapping,
          selected: fieldMappingChanges[changeKey]
        };
      }
      return mapping;
    });

    // Create a simple user message
    const changeMessage = 'apply field mappings';

    // Add user message to UI
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: changeMessage,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Add loading message
    const loadingMsgId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessage = {
      id: loadingMsgId,
      role: 'assistant',
      content: 'Updating field mappings...',
      timestamp: new Date().toISOString(),
      status: 'loading'
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await fetch(`${API_URL}/chat/conversational`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          message: 'apply field mappings',
          field_mappings: updatedMappings,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Replace loading message with actual response
      setMessages(prev =>
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: data.assistant_message_id?.toString() || `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response_text || data.response || 'Field mappings updated',
          ui_components: data.ui_components,
          timestamp: data.timestamp || new Date().toISOString(),
          next_prompt: data.next_prompt,
          status: 'success',
          metadata: data.metadata
        })
      );

      // Clear the changes state
      setFieldMappingChanges({});

    } catch (error) {
      console.error('Error applying field mappings:', error);
      
      setMessages(prev =>
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: `error-${Date.now()}`,
          role: 'system',
          content: 'Failed to apply field mappings. Please try again.',
          timestamp: new Date().toISOString(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (criterionId: string, entity: string, operator: string, value: any) => {
    const key = `${criterionId}_${entity}`;
    setCriteriaValues(prev => ({
      ...prev,
      [key]: { operator, value }
    }));
  };

  const applyConceptFilters = async (criteria: any[]) => {
    if (!project) return;

    setLoading(true);
    
    // Import useFieldMappings at the top level to use it here
    // For now, we'll use the direct API calls to create field mappings

    // Extract field mappings from criteria with concept mappings
    const filtersToApply: any[] = [];

    for (const criterion of criteria) {
      const dbMappings = criterion.db_mappings || {};
      
      for (const [entity, mapping] of Object.entries(dbMappings)) {
        const dbMapping = mapping as any;
        const uiComponent = dbMapping.ui_component;
        
        if (!uiComponent || !dbMapping['table.field']) continue;

        // Extract selected values from UI component config
        const config = uiComponent.config || {};
        const fieldType = dbMapping.field_data_type || 'object';
        const isNumeric = fieldType === 'int64' || fieldType === 'float64';
        
        // Check if we have stored values from user interaction
        const storedValueKey = `${criterion.id}_${entity}`;
        const storedValue = criteriaValues[storedValueKey];
        
        console.log(`[Apply Filters] Processing ${entity} (${fieldType}, numeric: ${isNumeric}):`, {
          storedValueKey,
          storedValue,
          configCurrentValue: config.current_value,
          configCurrentOperator: config.current_operator,
          configDefaultValue: config.default_value
        });
        
        let operator: string;
        let value: any;
        let selectedValues: any[] = [];
        
        // Extract operator - prioritize storedValue, then config
        operator = storedValue?.operator || config.current_operator;
        
        // Extract value - prioritize storedValue from user interaction
        let extractedValue = storedValue?.value;
        
        if (extractedValue === undefined || extractedValue === null) {
          // Fallback to config values
          if (isNumeric) {
            extractedValue = config.current_value !== undefined && config.current_value !== null 
              ? config.current_value 
              : (config.default_value !== undefined && config.default_value !== null ? config.default_value : undefined);
          } else {
            extractedValue = config.selected_values || config.current_values || config.value;
          }
        }
        
        console.log(`[Apply Filters] Extracted value for ${entity}:`, {
          extractedValue,
          extractedValueType: typeof extractedValue,
          isArray: Array.isArray(extractedValue),
          operator
        });
        
        // Handle numeric fields
        if (isNumeric) {
          // Check if we have a valid value (including 0)
          if (extractedValue === undefined || extractedValue === null) {
            console.log(`[Apply Filters] Skipping numeric field ${entity} - no value found`);
            continue; // Skip if no value
          }
          
          console.log(`[Apply Filters] Processing numeric value for ${entity}:`, {
            extractedValue,
            extractedValueType: typeof extractedValue,
            isArray: Array.isArray(extractedValue),
            currentOperator: operator
          });
          
          // Normalize numeric value format first, then determine operator
          if (Array.isArray(extractedValue) && extractedValue.length === 2) {
            // Array [min, max] format - typically means BETWEEN
            const minVal = extractedValue[0];
            const maxVal = extractedValue[1];
            
            // If both values are valid numbers, use BETWEEN
            if (typeof minVal === 'number' && typeof maxVal === 'number' && !isNaN(minVal) && !isNaN(maxVal)) {
              operator = 'BETWEEN';
              value = { min: minVal, max: maxVal };
            } else {
              console.log(`[Apply Filters] Invalid array values for ${entity}:`, extractedValue);
              continue;
            }
          } else if (typeof extractedValue === 'object' && extractedValue !== null && 'min' in extractedValue && 'max' in extractedValue) {
            // Already in {min, max} format
            const minVal = extractedValue.min;
            const maxVal = extractedValue.max;
            if (typeof minVal === 'number' && typeof maxVal === 'number' && !isNaN(minVal) && !isNaN(maxVal)) {
              value = extractedValue;
              operator = 'BETWEEN';
            } else {
              console.log(`[Apply Filters] Invalid object values for ${entity}:`, extractedValue);
              continue;
            }
          } else if (typeof extractedValue === 'number') {
            // Single numeric value (including 0)
            if (isNaN(extractedValue)) {
              console.log(`[Apply Filters] NaN value for ${entity}`);
              continue;
            }
            value = extractedValue;
            // Determine operator if not set
            if (!operator) {
              const operatorOptions = uiComponent.operator_options || [];
              const defaultOp = operatorOptions.find((opt: any) => opt.value)?.value;
              operator = defaultOp || '=';
            }
          } else if (typeof extractedValue === 'string') {
            // Try to parse string as number
            const parsed = parseFloat(extractedValue);
            if (!isNaN(parsed)) {
              value = parsed;
              // Determine operator if not set
              if (!operator) {
                const operatorOptions = uiComponent.operator_options || [];
                const defaultOp = operatorOptions.find((opt: any) => opt.value)?.value;
                operator = defaultOp || '=';
              }
            } else {
              console.log(`[Apply Filters] Cannot parse string as number for ${entity}:`, extractedValue);
              continue;
            }
          } else {
            console.log(`[Apply Filters] Unknown value type for numeric field ${entity}:`, typeof extractedValue, extractedValue);
            continue;
          }
          
          console.log(`[Apply Filters] Normalized numeric value for ${entity}:`, { value, operator });
        } else {
          // Non-numeric fields
          if (!extractedValue) {
            continue; // Skip if no value
          }
          
          if (Array.isArray(extractedValue)) {
            selectedValues = extractedValue;
          } else {
            selectedValues = [extractedValue];
          }
          
          // Set operator for non-numeric
          if (!operator) {
            operator = selectedValues.length > 1 ? 'IN' : '=';
          }
        }

        // Parse table.field to get table and field names
        const [tableName, fieldName] = dbMapping['table.field'].split('.');
        if (!tableName || !fieldName) continue;

        // For numeric fields, ensure we have a value
        if (isNumeric && (value === undefined || value === null)) {
          console.log(`Skipping numeric field ${fieldName} - no value extracted`);
          continue;
        }
        
        // For non-numeric fields, ensure we have selected values
        if (!isNumeric && selectedValues.length === 0) {
          console.log(`Skipping non-numeric field ${fieldName} - no values extracted`);
          continue;
        }

        console.log(`Adding filter for ${fieldName}:`, {
          table_name: tableName,
          field_name: fieldName,
          field_type: fieldType,
          values: isNumeric ? value : selectedValues,
          operator: operator,
          isNumeric
        });

        // Create filter object
        filtersToApply.push({
          table_name: tableName,
          field_name: fieldName,
          field_type: fieldType,
          values: isNumeric ? value : selectedValues,
          operator: operator,
          table_field: dbMapping['table.field'],
          entity: entity,
          criterion_type: criterion.type || 'include'
        });
      }
    }

    console.log('Filters to apply:', filtersToApply);

    if (filtersToApply.length === 0) {
      console.log('No filters to apply - all filters were skipped');
      setLoading(false);
      return;
    }

    // Create a user message
    const filterMessage = `Apply filters: ${filtersToApply.map(f => {
      const isNumeric = f.field_type === 'int64' || f.field_type === 'float64';
      if (isNumeric) {
        const val = f.values;
        if (typeof val === 'object' && val !== null && 'min' in val && 'max' in val) {
          return `${f.field_name} is between ${val.min} and ${val.max}`;
        } else if (f.operator === '>=') {
          return `${f.field_name} >= ${val}`;
        } else if (f.operator === '>') {
          return `${f.field_name} > ${val}`;
        } else if (f.operator === '<=') {
          return `${f.field_name} <= ${val}`;
        } else if (f.operator === '<') {
          return `${f.field_name} < ${val}`;
        } else if (f.operator === '=' || f.operator === '==') {
          return `${f.field_name} = ${val}`;
        } else {
          return `${f.field_name} = ${val}`;
        }
      } else {
        return `${f.field_name} is ${Array.isArray(f.values) ? f.values.join(', ') : f.values}`;
      }
    }).join(', ')}`;

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: filterMessage,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Add loading message
    const loadingMsgId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessage = {
      id: loadingMsgId,
      role: 'assistant',
      content: 'Applying filters...',
      timestamp: new Date().toISOString(),
      status: 'loading'
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const csrfToken = getCookie('csrftoken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      // Create field mappings for each filter and save them to the database
      const fieldMappingsToSend = [];
      
      for (const filter of filtersToApply) {
        const isNumeric = filter.field_type === 'int64' || filter.field_type === 'float64';
        let sqlCriterion = '';
        let displayText = '';
        let value: any;

        console.log(`[Create Mapping] Processing filter for ${filter.field_name}:`, {
          isNumeric,
          values: filter.values,
          valuesType: typeof filter.values,
          operator: filter.operator,
          table_field: filter.table_field
        });

        if (isNumeric) {
          // Handle numeric fields
          const numValue = filter.values;
          
          if (filter.operator === 'BETWEEN' || (typeof numValue === 'object' && numValue !== null && 'min' in numValue && 'max' in numValue)) {
            // BETWEEN operator
            const minVal = typeof numValue === 'object' && 'min' in numValue ? numValue.min : (Array.isArray(numValue) ? numValue[0] : null);
            const maxVal = typeof numValue === 'object' && 'max' in numValue ? numValue.max : (Array.isArray(numValue) ? numValue[1] : null);
            
            console.log(`[Create Mapping] BETWEEN values:`, { minVal, maxVal, numValue });
            
            if (minVal !== undefined && maxVal !== undefined && minVal !== null && maxVal !== null) {
              sqlCriterion = `${filter.table_field} BETWEEN ${minVal} AND ${maxVal}`;
              displayText = `${filter.field_name} between ${minVal} and ${maxVal}`;
              value = { min: minVal, max: maxVal };
            } else {
              console.error(`[Create Mapping] Invalid BETWEEN values for ${filter.field_name}:`, { minVal, maxVal });
            }
          } else if (filter.operator === '>=') {
            // Greater than or equal
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} >= ${numVal}`;
              displayText = `${filter.field_name} >= ${numVal}`;
              value = numVal;
            } else {
              console.error(`[Create Mapping] Invalid >= value for ${filter.field_name}:`, numVal);
            }
          } else if (filter.operator === '>') {
            // Greater than
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} > ${numVal}`;
              displayText = `${filter.field_name} > ${numVal}`;
              value = numVal;
            } else {
              console.error(`[Create Mapping] Invalid > value for ${filter.field_name}:`, numVal);
            }
          } else if (filter.operator === '<=') {
            // Less than or equal
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} <= ${numVal}`;
              displayText = `${filter.field_name} <= ${numVal}`;
              value = numVal;
            } else {
              console.error(`[Create Mapping] Invalid <= value for ${filter.field_name}:`, numVal);
            }
          } else if (filter.operator === '<') {
            // Less than
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} < ${numVal}`;
              displayText = `${filter.field_name} < ${numVal}`;
              value = numVal;
            } else {
              console.error(`[Create Mapping] Invalid < value for ${filter.field_name}:`, numVal);
            }
          } else if (filter.operator === '=' || filter.operator === '==') {
            // Equals
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} = ${numVal}`;
              displayText = `${filter.field_name} = ${numVal}`;
              value = numVal;
            } else {
              console.error(`[Create Mapping] Invalid = value for ${filter.field_name}:`, numVal);
            }
          } else {
            // Default: equals (fallback)
            const numVal = typeof numValue === 'number' ? numValue : (Array.isArray(numValue) ? numValue[0] : (typeof numValue === 'string' ? parseFloat(numValue) : numValue));
            if (typeof numVal === 'number' && !isNaN(numVal)) {
              sqlCriterion = `${filter.table_field} = ${numVal}`;
              displayText = `${filter.field_name} = ${numVal}`;
              value = numVal;
              // Update operator to '=' if not set
              filter.operator = '=';
            } else {
              console.error(`[Create Mapping] Invalid default value for ${filter.field_name}:`, numVal);
            }
          }
        } else {
          // Handle non-numeric fields (object/string)
          const values = Array.isArray(filter.values) ? filter.values : [filter.values];
          
          if (filter.operator === 'IN' || values.length > 1) {
            sqlCriterion = `${filter.table_field} IN (${values.map((v: any) => `'${v}'`).join(', ')})`;
            displayText = `${filter.field_name}: ${values.join(', ')}`;
            value = values;
          } else {
            sqlCriterion = `${filter.table_field} = '${values[0]}'`;
            displayText = `${filter.field_name}: ${values[0]}`;
            value = values.length === 1 ? values[0] : values;
          }
        }

        if (!sqlCriterion) continue; // Skip if we couldn't generate SQL

        const mappingData = {
          table_name: filter.table_name,
          field_name: filter.field_name,
          field_type: filter.field_type,
          concept: filter.entity,
          operator: filter.operator,
          value: value,
          sql_criterion: sqlCriterion,
          display_text: displayText,
          source: 'user' as const,
          status: 'draft' as const,
        };

        // Delete existing mappings for this field first (to replace them)
        const existingMappings = contextMappings.filter(
          (m: any) => m.table_name === filter.table_name && 
                      m.field_name === filter.field_name && 
                      m.source === 'user'
        );
        
        for (const existingMapping of existingMappings) {
          try {
            await apiDeleteFieldMapping(project.id, existingMapping.id.toString());
          } catch (error) {
            console.error('Failed to delete existing mapping:', error);
          }
        }

        // Create new field mapping
        try {
          await apiCreateFieldMapping(project.id, mappingData);
          fieldMappingsToSend.push(mappingData);
        } catch (error) {
          console.error('Failed to create field mapping:', error);
        }
      }

      // Refresh mappings so the left panel updates
      await refreshMappings();

      // Send to agent to update criteria
      const response = await fetch(`${API_URL}/chat/conversational`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          project_id: project.id,
          message: filterMessage,
          field_mappings: fieldMappingsToSend,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Replace loading message with actual response
      setMessages(prev =>
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: data.assistant_message_id?.toString() || `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response_text || data.response || 'Filters applied successfully',
          ui_components: data.ui_components,
          timestamp: data.timestamp || new Date().toISOString(),
          next_prompt: data.next_prompt,
          status: 'success',
          metadata: data.metadata
        })
      );

    } catch (error) {
      console.error('Error applying concept filters:', error);
      
      setMessages(prev =>
        prev.filter(m => m.id !== loadingMsgId).concat({
          id: `error-${Date.now()}`,
          role: 'system',
          content: 'Failed to apply filters. Please try again.',
          timestamp: new Date().toISOString(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const renderUIComponent = (component: any, message: ChatMessage) => {
    if (!component) return null;

    console.log('Rendering UI component:', component);

    // Extract stage from message metadata (handle nested metadata)
    const stage = message.metadata?.stage !== undefined 
      ? message.metadata.stage 
      : message.metadata?.metadata?.stage !== undefined
        ? message.metadata.metadata.stage
        : message.stage !== undefined
          ? message.stage
          : currentStage;
    
    // Extract criteria from message metadata (handle nested metadata)
    const criteria = message.metadata?.criteria 
      || message.metadata?.metadata?.criteria 
      || accumulatedCriteria;
    
    // Extract field mappings from message metadata (handle nested metadata)
    const fieldMappings = message.metadata?.fieldMappings 
      || message.metadata?.metadata?.fieldMappings 
      || accumulatedFieldMappings;

    // Use progressive layout for criteria-related components
    if (component.type === 'criteria_chips' || component.type === 'criteria_form' || component.type === 'schema_mapping') {
      // Extract criteria from component or metadata
      let extractedCriteria = criteria;
      if (component.type === 'criteria_chips' || component.type === 'criteria_form') {
        extractedCriteria = component.data || criteria;
      }

      // Extract field mappings
      let extractedFieldMappings = fieldMappings;
      if (component.type === 'schema_mapping') {
        extractedFieldMappings = component.data || fieldMappings;
      }
      
      // If field mappings are empty but criteria have db_mappings, extract them from criteria
      if (extractedFieldMappings.length === 0 && extractedCriteria.length > 0) {
        extractedFieldMappings = extractedCriteria.flatMap((criterion: any) => {
          const entities = Object.keys(criterion.db_mappings || {});
          return entities.map((entity: string) => {
            const dbMapping = criterion.db_mappings[entity];
            if (dbMapping && dbMapping['table.field']) {
              const tableField = dbMapping['table.field'];
              const rankedMatches = dbMapping.ranked_matches || [tableField];
              
              return {
                entity: entity,
                selected: tableField,
                options: rankedMatches,
                attribute: dbMapping.attribute || entity,
                criterion_text: criterion.text,
                field_description: dbMapping.field_description || '',
              };
            }
            return null;
          }).filter(Boolean);
        });
      }

      // Concept mappings are in criteria with ui_components
      const conceptMappings = extractedCriteria.filter((c: any) => 
        Object.values(c.db_mappings || {}).some((m: any) => m.ui_component)
      );

      return (
        <ProgressiveCriteriaLayout
          criteria={extractedCriteria}
          fieldMappings={extractedFieldMappings}
          conceptMappings={conceptMappings}
          stage={stage}
          onValueChange={handleValueChange}
          onFieldMappingChange={(idx, selectedField) => {
            const changeKey = `mapping_${idx}`;
            setFieldMappingChanges(prev => {
              // If resetting to original value, remove from changes
              const originalMapping = extractedFieldMappings[idx];
              if (originalMapping && selectedField === originalMapping.selected) {
                const newChanges = { ...prev };
                delete newChanges[changeKey];
                return newChanges;
              }
              // Otherwise, update the change
              return {
                ...prev,
                [changeKey]: selectedField
              };
            });
          }}
          onApplyFieldMappings={applyFieldMappings}
          onApplyConceptFilters={applyConceptFilters}
          fieldMappingChanges={fieldMappingChanges}
          disabled={loading}
        />
      );
    }

    switch (component.type) {

      case 'sql_preview':
        return (
          <div className="my-3 p-4 bg-purple-50 border border-purple-200 rounded-lg w-[70%]">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">Generated SQL Query</h4>
            <SQLPreview
              sql={component.data?.sql_query || ''}
              explanation={component.data?.explanation}
              validation={component.data?.validation}
            />
          </div>
        );

      case 'query_results':
        return (
          <div className="my-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-900 mb-2">Query Results</h4>
            <QueryResults 
              results={component.data || { total_count: 0, columns: [], preview: [] }}
              queryId={component.data?.query_id}
              onDownload={() => {
                const gcsPath = component.data?.gcs_path;
                if (gcsPath) {
                  window.open(gcsPath, '_blank');
                }
              }}
            />
          </div>
        );


      case 'validation_errors':
        return (
          <div className="my-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-800 mb-2">Validation Errors:</h4>
            <ul className="list-disc list-inside text-sm text-red-700">
              {(component.data?.errors || []).map((error: string, idx: number) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  const renderMessageContent = (message: ChatMessage) => {
    // Handle different message statuses
    if (message.status === 'loading') {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
          <span className="text-sm text-gray-600">{message.content}</span>
        </div>
      );
    }

    if (message.status === 'error') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <p className="text-sm text-red-700">{message.content}</p>
          {message.error_message && (
            <p className="text-xs text-red-600 mt-2 font-mono bg-red-50 p-2 rounded">
              {message.error_message}
            </p>
          )}
        </div>
      );
    }

    // Render normal message content with markdown support for assistant
    return (
      <div className="space-y-2">
        {message.metadata?.thinking && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-700" />
              <span className="text-xs font-medium text-yellow-800">Thinking</span>
            </div>
            <p className="text-xs text-yellow-700 italic">{message.metadata.thinking}</p>
          </div>
        )}

        {message.metadata?.tool_calls && message.metadata.tool_calls.length > 0 && (
          <div className="mb-3 space-y-2">
            {message.metadata.tool_calls.map((tool, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                {tool.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-purple-600" />}
                {tool.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                {tool.status === 'failed' && <XCircle className="w-3 h-3 text-red-600" />}
                <span className="font-medium text-gray-700">{tool.tool}</span>
                <span className="text-gray-500">-</span>
                <span className="text-gray-600">{tool.description}</span>
              </div>
            ))}
          </div>
        )}

        {message.role === 'assistant' ? (
          <div className="prose prose-sm max-w-none text-gray-800">
            {message.content.split('\n').map((line, i) => (
              <p key={i} className="mb-2 last:mb-0">{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    );
  };

  // Show loading state while project is loading
  if (loadingProject) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-2" />
        <p className="text-sm text-gray-600">Loading project...</p>
      </div>
    );
  }

  // Show error if project not found or failed to load
  if (projectError || (!loadingProject && !project)) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
        <p className="text-sm text-red-600 mb-4">
          {projectError || 'Project not found or you do not have access to it.'}
        </p>
        {projectId && (
          <button
            onClick={() => {
              setProjectError(null);
              loadProject();
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Project Header */}
      {project && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{project.name}</h3>
              <p className="text-xs text-gray-500">{project.atlas_name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center max-w-md">
              <Bot className="w-12 h-12 mx-auto mb-4 text-purple-500" />
              <p className="text-lg mb-2 text-gray-700 font-semibold">
                Welcome to Cohort Builder
              </p>
              <p className="text-sm mb-6">
                {project 
                  ? `Start building "${project.name}" by describing your cohort criteria`
                  : 'Please select a project from the Cohorts page'}
              </p>
              {project && (
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {SUGGESTED_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-purple-100 border-purple-300' 
                  : message.role === 'system'
                    ? 'bg-red-500 text-white'
                    : 'bg-white border-purple-400'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : message.role === 'system' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Content */}
              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                <div className={`rounded-2xl px-5 py-3 w-full ${
                  message.role === 'user'
                    ? 'bg-[#F5F0FB] border border-[#E8DDFF] text-gray-800'
                    : message.role === 'system'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : message.status === 'loading'
                        ? 'bg-white border border-gray-200 text-gray-600'
                        : 'bg-white text-gray-800'
                }`}>
                  {renderMessageContent(message)}
                </div>

                {/* UI Components */}
                {message.status === 'success' && (
                  <div className="mt-2">
                    {(() => {
                      // Extract ui_components from message or metadata
                      let uiComponents = message.ui_components;
                      if (!uiComponents && message.metadata) {
                        // Try to get from metadata
                        uiComponents = message.metadata.ui_components || message.metadata.metadata?.ui_components;
                      }
                      
                      // If we have ui_components, render them
                      if (uiComponents) {
                        return renderUIComponent(uiComponents, message);
                      }
                      
                      // If no ui_components but we have criteria in metadata, show progressive layout
                      const metadataCriteria = message.metadata?.criteria || message.metadata?.metadata?.criteria;
                      const metadataStage = message.metadata?.stage || message.metadata?.metadata?.stage || message.stage || currentStage;
                      
                      if (metadataCriteria && metadataCriteria.length > 0) {
                        // Extract field mappings from metadata
                        const metadataFieldMappings = message.metadata?.fieldMappings || message.metadata?.metadata?.fieldMappings || [];
                        
                        return (
                          <ProgressiveCriteriaLayout
                            criteria={metadataCriteria}
                            fieldMappings={metadataFieldMappings}
                            conceptMappings={metadataCriteria.filter((c: any) => 
                              Object.values(c.db_mappings || {}).some((m: any) => m.ui_component)
                            )}
                            stage={metadataStage}
                            onValueChange={handleValueChange}
                            onFieldMappingChange={(idx, selectedField) => {
                              const changeKey = `mapping_${idx}`;
                              setFieldMappingChanges(prev => ({
                                ...prev,
                                [changeKey]: selectedField
                              }));
                            }}
                            onApplyFieldMappings={applyFieldMappings}
                            onApplyConceptFilters={applyConceptFilters}
                            fieldMappingChanges={fieldMappingChanges}
                            disabled={loading}
                          />
                        );
                      }
                      
                      return null;
                    })()}
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-1 text-xs text-gray-400">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="px-4 py-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end bg-white border border-[#E8DDFF] rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              project 
                ? "Talk to Polly Co-Scientist..."
                : "Please select a project from the Cohorts page first"
            }
            disabled={loading || !project}
            className="flex-1 px-2 py-2 border-0 resize-none overflow-hidden focus:outline-none focus:ring-0 focus:border-0 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 placeholder:text-gray-400"
            style={{ minHeight: '40px', maxHeight: '200px' }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || !project}
            className="flex-shrink-0 p-3 bg-[#6B2FCC] text-white rounded-full hover:bg-[#5E22A6] active:bg-[#4D1A8C] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
