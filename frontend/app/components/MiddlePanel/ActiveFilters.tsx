'use client';

import React from 'react';
import { useFilters } from '@/app/contexts/FilterContext';
import FilterCard from './FilterCard';
import { Loader2 } from 'lucide-react';

export default function ActiveFilters() {
  const { filters, cohortCount, clearFilters, loading } = useFilters();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b bg-white" style={{ borderColor: '#6B7280' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
            Active Filters {filters.length > 0 && `(${filters.length})`}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#06B6D4' }} />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: '#06B6D4' }}>
                {cohortCount.toLocaleString()}
              </span>
              <span className="text-sm" style={{ color: '#6B7280' }}>
                patients
              </span>
            </div>
          )}
          {filters.length > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm hover:underline"
              style={{ color: '#FF004D' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FF004D')}
              onMouseLeave={e => (e.currentTarget.style.color = '#FF004D')}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filters Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filters.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: '#6B7280' }}>
            <p className="text-center">
              No filters applied yet.
              <br />
              Use the chat below to add filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filters.map(filter => (
              <FilterCard key={filter.id} filter={filter} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
