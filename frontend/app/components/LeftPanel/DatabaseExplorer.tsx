'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Database, Table, AlertCircle, Loader2 } from 'lucide-react';
import { convertSchemaToTables } from '@/app/lib/schemaHelper';
import api from '@/app/lib/api';
import Tag from '@/app/components/ui/Tag';

interface DatabaseExplorerProps {
  projectId?: string;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

// Helper function to get tag variant based on data type - Polly Palette
const getDataTypeVariant = (type: string): 'blue' | 'teal' | 'yellow' | 'gray' => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('int') || lowerType.includes('float') || lowerType.includes('number')) {
    return 'blue'; // Numeric/quantitative data
  } else if (lowerType.includes('bool')) {
    return 'teal'; // Boolean data
  } else if (lowerType.includes('date') || lowerType.includes('time')) {
    return 'yellow'; // Temporal data
  }
  return 'gray'; // String/text types
};

export default function DatabaseExplorer({ projectId, isCollapsed: externalCollapsed, onCollapseChange }: DatabaseExplorerProps) {
  const [tables, setTables] = useState<any[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const [checkingCache, setCheckingCache] = useState(true);
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

  useEffect(() => {
    if (projectId) {
      checkCacheAndLoadSchema();
    } else {
      loadDatabaseSchemaFromLocal();
    }
  }, [projectId]);

  const checkCacheAndLoadSchema = async () => {
    setCheckingCache(true);
    setError(null);
    
    try {
      // Check cache status first
      const cacheResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/cohort-projects/${projectId}/cache-status`,
        { credentials: 'include' }
      );
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.is_ready) {
          setIsCacheReady(true);
          setCheckingCache(false);
          // Cache is ready, load schema
          await loadDatabaseSchemaFromAPI();
        } else {
          // Cache not ready yet, but try loading anyway (backend will handle fallback)
          setCheckingCache(false);
          await loadDatabaseSchemaFromAPI();
        }
      } else {
        // Cache check failed, try loading anyway
        setCheckingCache(false);
        await loadDatabaseSchemaFromAPI();
      }
    } catch (error) {
      console.error('Cache check failed:', error);
      setCheckingCache(false);
      // Try loading anyway
      await loadDatabaseSchemaFromAPI();
    }
  };

  const loadDatabaseSchemaFromAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch schema from backend API
      const schemaData = await api.get(`/cohort-projects/${projectId}/schema`);
      
      // Convert schema to tables format
      const schemaToTables = convertSchemaToTablesFromData(schemaData);
      setTables(schemaToTables);
    } catch (error: any) {
      console.error('Error loading database schema from API:', error);
      const errorMessage = error?.message || 'Failed to load database schema';
      setError(errorMessage);
      
      // Fallback to local schema if API fails
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        loadDatabaseSchemaFromLocal();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseSchemaFromLocal = () => {
    try {
      // Load schema from db_schema.json via helper (fallback)
      const schemaToTables = convertSchemaToTables();
      setTables(schemaToTables);
      setError(null);
    } catch (error) {
      console.error('Error loading database schema:', error);
      setError('Failed to load database schema');
    } finally {
      setLoading(false);
    }
  };

  const convertSchemaToTablesFromData = (schemaData: any) => {
    const tableNames = Object.keys(schemaData);
    
    return tableNames.map(tableName => {
      const tableSchema = schemaData[tableName];
      if (!tableSchema) return null;

      const fields = tableSchema.fields;
      const columns = Object.entries(fields).map(([fieldName, fieldData]: [string, any]) => {
        const column: any = {
          name: fieldName,
          type: fieldData.field_data_type,
          description: fieldData.field_description,
        };

        // Add values if available
        if (Array.isArray(fieldData.field_unique_values)) {
          column.values = fieldData.field_unique_values;
        } else if (fieldData.field_sample_values && fieldData.field_sample_values.length > 0) {
          column.sample_values = fieldData.field_sample_values;
        }

        // Add range info for numeric fields
        if (fieldData.field_data_type === 'int64' || fieldData.field_data_type === 'float64') {
          const samples = fieldData.field_sample_values;
          if (samples && samples.length > 0) {
            column.min = Math.min(...samples);
            column.max = Math.max(...samples);
          }
        }

        column.uniqueness_percent = fieldData.field_uniqueness_percent;

        return column;
      });

      return {
        name: tableName,
        description: tableSchema.table_description,
        record_count: 0,
        columns,
      };
    }).filter(Boolean);
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
            <Database className="w-5 h-5" style={{ color: '#8E42EE' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
              Database Schema
            </h2>
          </div>
        </button>
        {!isSectionCollapsed && (
          <>
            {checkingCache || loading ? (
              <p className="text-xs mt-1 ml-6" style={{ color: '#6B7280' }}>
                {checkingCache ? 'Checking cache...' : 'Loading schema...'}
              </p>
            ) : (
              <p className="text-xs mt-1 ml-6" style={{ color: '#6B7280' }}>
                {tables.length} tables available
              </p>
            )}
            {error && (
              <div className="mt-2 ml-6 flex items-center gap-2 text-xs" style={{ color: '#FF004D' }}>
                <AlertCircle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tables List */}
      {!isSectionCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
        {checkingCache || loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8E42EE' }} />
          </div>
        ) : (
          <div className="space-y-2">
          {tables.map((table: any) => (
            <div
              key={table.name}
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: '#6B7280' }}
            >
              {/* Table Header */}
              <button
                onClick={() => toggleTable(table.name)}
                className="w-full flex items-center justify-between p-3 transition-colors"
                style={{ backgroundColor: 'white' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7E21720')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
              >
                <div className="flex items-center gap-2">
                  {expandedTables.has(table.name) ? (
                    <ChevronDown className="w-4 h-4" style={{ color: '#6B7280' }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: '#6B7280' }} />
                  )}
                  <Table className="w-4 h-4" style={{ color: '#8E42EE' }} />
                  <span className="font-medium text-sm" style={{ color: '#111827' }}>
                    {table.name}
                  </span>
                </div>
                <Tag variant="purple" style="light" size="sm">
                  {table.columns.length} columns
                </Tag>
              </button>

              {/* Columns */}
              {expandedTables.has(table.name) && (
                <div className="bg-gray-50 border-t border-gray-200">
                  <div className="p-3 space-y-2">
                    {table.columns.map((column: any) => (
                      <div
                        key={column.name}
                        className="flex items-start justify-between text-xs p-2 bg-white rounded border transition-colors cursor-pointer"
                        style={{ borderColor: '#6B728040' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#8E42EE')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#6B728040')}
                      >
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: '#111827' }}>
                            {column.name}
                          </div>
                          <div className="mt-1">
                            <Tag 
                              variant={getDataTypeVariant(column.type)} 
                              style="light" 
                              size="sm"
                            >
                              {column.type}
                            </Tag>
                          </div>
                          {column.values && column.values.length > 0 && (
                            <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                              Values: {column.values.slice(0, 3).join(', ')}
                              {column.values.length > 3 && ` (+${column.values.length - 3} more)`}
                            </div>
                          )}
                          {column.sample_values && column.sample_values.length > 0 && !column.values && (
                            <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                              Sample: {column.sample_values.slice(0, 3).join(', ')}...
                            </div>
                          )}
                          {(column.min !== undefined || column.max !== undefined) && (
                            <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                              Range: {column.min} - {column.max}
                            </div>
                          )}
                          {column.uniqueness_percent !== undefined && (
                            <div className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                              Uniqueness: {(column.uniqueness_percent * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
