'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Table2 } from 'lucide-react';
import { mockDatabaseSchema } from '@/app/lib/mockData';

interface DatabaseSchemaPanelProps {
  cohortId: string;
}

export default function DatabaseSchemaPanel({ cohortId }: DatabaseSchemaPanelProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

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
      <div className="border-b p-4" style={{ borderColor: '#6B7280' }}>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: '#06B6D4' }} />
          <h3 className="font-semibold" style={{ color: '#111827' }}>
            Database Schema
          </h3>
        </div>
        <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
          {mockDatabaseSchema.length} tables
        </p>
      </div>

      {/* Schema List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {mockDatabaseSchema.map(table => (
            <div
              key={table.name}
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: '#6B7280' }}
            >
              <button
                onClick={() => toggleTable(table.name)}
                className="w-full flex items-center justify-between p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {expandedTables.has(table.name) ? (
                    <ChevronDown className="w-4 h-4" style={{ color: '#6B7280' }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: '#6B7280' }} />
                  )}
                  <Table2 className="w-4 h-4" style={{ color: '#06B6D4' }} />
                  <span className="font-medium text-sm" style={{ color: '#111827' }}>
                    {table.name}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#6B728020', color: '#111827' }}>
                  {table.record_count.toLocaleString()} rows
                </span>
              </button>

              {expandedTables.has(table.name) && (
                <div className="border-t bg-gray-50" style={{ borderColor: '#6B728040' }}>
                  <div className="p-3">
                    <div className="text-xs font-semibold mb-2" style={{ color: '#6B7280' }}>
                      COLUMNS
                    </div>
                    <div className="space-y-1">
                      {table.columns.map(column => (
                        <div
                          key={column.name}
                          className="flex items-center justify-between p-2 rounded"
                          style={{ backgroundColor: 'white' }}
                        >
                          <span className="text-sm" style={{ color: '#111827' }}>
                            {column.name}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#06B6D420', color: '#06B6D4' }}
                          >
                            {column.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filtered Patient Table Section */}
      <div className="border-t p-4" style={{ borderColor: '#6B7280' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>
          Filtered Patients
        </h4>
        <div className="text-xs text-center py-8" style={{ color: '#6B7280' }}>
          Patient data table coming soon
        </div>
      </div>
    </div>
  );
}
