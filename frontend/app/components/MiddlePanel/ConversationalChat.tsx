'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, User, Bot, Loader2, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { CriteriaChips, SQLPreview, QueryResults } from '@/app/components/criteria';
import DynamicCriterionComponent from '@/app/components/criteria/DynamicCriterionComponent';
import { Button } from '@/app/components/ui';
import Tag from '@/app/components/ui/Tag';

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
  const [criteriaValues, setCriteriaValues] = useState<{ [key: string]: any }>({});
  const [fieldMappingChanges, setFieldMappingChanges] = useState<{ [key: string]: string }>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load project from API
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoadingProject(true);
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
        } else {
          console.error('Failed to load project');
        }
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setLoadingProject(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

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
          const chatMessages: ChatMessage[] = data.messages.reverse().map((msg: any) => ({
            id: msg.id.toString(),
            role: msg.role,
            content: msg.content,
            ui_components: msg.metadata?.ui_components,
            timestamp: msg.created_at,
            next_prompt: msg.metadata?.next_prompt,
            status: 'success',
            metadata: msg.metadata
          }));
          
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
          metadata: data.metadata
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

  const renderUIComponent = (component: any) => {
    if (!component) return null;

    console.log('Rendering UI component:', component);

    switch (component.type) {
      case 'criteria_chips':
        return (
          <div className="my-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Extracted Criteria</h4>
            <CriteriaChips criteria={component.data || []} editable={false} />
          </div>
        );

      case 'criteria_form':
        return (
          <div className="my-3 space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Adjust Criteria Values</h4>
            {(component.data || []).map((criterion: any) => (
              <DynamicCriterionComponent
                key={criterion.id}
                criterion={criterion}
                onValueChange={handleValueChange}
                disabled={loading}
              />
            ))}
          </div>
        );

      case 'sql_preview':
        return (
          <div className="my-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
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

      case 'schema_mapping':
        const mappingData = component.data || [];
        const hasChanges = Object.keys(fieldMappingChanges).length > 0;
        
        return (
          <div className="my-3 space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Field Mappings</h4>
              <p className="text-sm text-blue-700 mb-4">
                Review the database fields selected for each criterion. You can change them using the dropdowns below.
              </p>
              {mappingData.map((mapping: any, idx: number) => {
                const changeKey = `mapping_${idx}`;
                const currentValue = fieldMappingChanges[changeKey] || mapping.selected;
                const isChanged = fieldMappingChanges[changeKey] && fieldMappingChanges[changeKey] !== mapping.selected;
                
                return (
                  <div key={idx} className={`mb-4 p-3 bg-white rounded border`}>
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-500 uppercase">Entity:</span>
                      <span className="ml-2">
                        <Tag variant="blue" style="light" size="sm">
                          {mapping.entity}
                        </Tag>
                      </span>
                      {isChanged && (
                        <span className="ml-2">
                          <Tag variant="teal" style="light" size="sm">
                            Modified
                          </Tag>
                        </span>
                      )}
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Database Field:
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={currentValue}
                        onChange={(e) => {
                          setFieldMappingChanges(prev => ({
                            ...prev,
                            [changeKey]: e.target.value
                          }));
                        }}
                        disabled={loading}
                      >
                        {(mapping.options || []).map((option: string) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
              
              {hasChanges && (
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => applyFieldMappings(mappingData)}
                    disabled={loading}
                  >
                    Apply Changes
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setFieldMappingChanges({})}
                    disabled={loading}
                  >
                    Reset
                  </Button>
                </div>
              )}
            </div>
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
                {tool.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-gray-600">Loading project...</p>
      </div>
    );
  }

  // Show error if project not found
  if (!loadingProject && !project) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
        <p className="text-sm text-red-600">Project not found</p>
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
            <div className="flex items-center gap-2">
              {loading && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center max-w-md">
              <Bot className="w-12 h-12 mx-auto mb-4 text-[#06B6D4]" />
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
                      className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[#06B6D4] transition-colors"
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
                  ? 'bg-blue-500 text-white' 
                  : message.role === 'system'
                    ? 'bg-red-500 text-white'
                    : 'bg-[#06B6D4] text-white'
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
                <div className={`rounded-lg px-4 py-3 w-full ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : message.status === 'loading'
                        ? 'bg-gray-50 border border-gray-200'
                        : 'bg-gray-100 text-gray-800'
                }`}>
                  {renderMessageContent(message)}
                </div>

                {/* UI Components */}
                {message.ui_components && message.status === 'success' && (
                  <div className="w-full mt-2">
                    {renderUIComponent(message.ui_components)}
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
      <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              project 
                ? "Type your message... (e.g., 'yes', 'generate SQL', or describe new criteria)"
                : "Please select a project from the Cohorts page first"
            }
            disabled={loading || !project}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '200px' }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || !project}
            className="flex-shrink-0 p-3 bg-[#06B6D4] text-white rounded-full hover:bg-[#111827] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
          </button>
        </div>
        {loading && (
          <p className="text-xs text-gray-500 mt-2">Agent is processing your request...</p>
        )}
      </div>
    </div>
  );
}
