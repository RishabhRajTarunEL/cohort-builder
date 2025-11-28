'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Database, Table, AlertCircle } from 'lucide-react';
import { convertSchemaToTables } from '@/app/lib/schemaHelper';
import api from '@/app/lib/api';

interface DatabaseExplorerProps {
  projectId?: string;
}

export default function DatabaseExplorer({ projectId }: DatabaseExplorerProps) {
  const [tables, setTables] = useState<any[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadDatabaseSchemaFromAPI();
    } else {
      loadDatabaseSchemaFromLocal();
    }
  }, [projectId]);

  const loadDatabaseSchemaFromAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch schema from backend API
      const schemaData = await api.get(`/cohort-projects/${projectId}/schema`);
      
      // Convert schema to tables format
      const schemaToTables = convertSchemaToTablesFromData(schemaData);
      setTables(schemaToTables);
    } catch (error) {
      console.error('Error loading database schema from API:', error);
      setError('Failed to load database schema');
      
      // Fallback to local schema
      loadDatabaseSchemaFromLocal();
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

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b p-4 z-10" style={{ borderColor: '#6B7280' }}>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: '#06B6D4' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
            Database Schema
          </h2>
        </div>
        <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
          {tables.length} tables available
        </p>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#FF004D' }}>
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-4">
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
                  <Table className="w-4 h-4" style={{ color: '#F7E217' }} />
                  <span className="font-medium text-sm" style={{ color: '#111827' }}>
                    {table.name}
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: '#6B7280', backgroundColor: '#F7E21740' }}
                >
                  {table.columns.length} columns
                </span>
              </button>

              {/* Columns */}
              {expandedTables.has(table.name) && (
                <div className="bg-gray-50 border-t" style={{ borderColor: '#6B7280' }}>
                  <div className="p-3 space-y-2">
                    {table.columns.map((column: any) => (
                      <div
                        key={column.name}
                        className="flex items-start justify-between text-xs p-2 bg-white rounded border transition-colors cursor-pointer"
                        style={{ borderColor: '#6B728040' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#06B6D4')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#6B728040')}
                      >
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: '#111827' }}>
                            {column.name}
                          </div>
                          <div className="mt-0.5" style={{ color: '#6B7280' }}>
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] mr-1"
                              style={{ backgroundColor: '#24CF3540', color: '#111827' }}
                            >
                              {column.type}
                            </span>
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
      </div>
    </div>
  );
}
