'use client';

import React from 'react';
import { useFilters } from '@/app/contexts/FilterContext';
import { Filter } from '@/app/lib/types';
import { X, Edit2 } from 'lucide-react';
import Tag from '@/app/components/ui/Tag';

interface FilterCardProps {
  filter: Filter;
}

export default function FilterCard({ filter }: FilterCardProps) {
  const { toggleFilter, removeFilter } = useFilters();

  return (
    <div
      className={`
        p-3 rounded-lg border-2 transition-all
        ${
          filter.enabled
            ? filter.type === 'include'
              ? 'bg-[#24CF35]/20'
              : 'bg-[#F78E12]/20'
            : 'bg-gray-100 opacity-60'
        }
      `}
      style={{
        borderColor: filter.enabled
          ? filter.type === 'include'
            ? '#06B6D4'
            : '#FF004D'
          : '#d1d5db',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Checkbox and Content */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={filter.enabled}
            onChange={() => toggleFilter(filter.id)}
            className="mt-1 cursor-pointer flex-shrink-0 accent-[#06B6D4]"
          />
          <div className="flex-1 min-w-0">
            {/* Filter Type Badge */}
            <div className="flex items-center gap-2 mb-1">
              <Tag
                variant={filter.type === 'include' ? 'purple' : 'orange'}
                style="dark"
                size="sm"
              >
                {filter.type === 'include' ? 'INCLUDE' : 'EXCLUDE'}
              </Tag>
            </div>

            {/* Filter Text */}
            <div className="font-medium text-sm break-words" style={{ color: '#111827' }}>
              {filter.text}
            </div>

            {/* Criterion */}
            <div className="text-xs mt-1 font-mono break-all" style={{ color: '#6B7280' }}>
              {filter.revised_criterion}
            </div>

            {/* Affected Count */}
            {filter.affectedCount && (
              <div className="text-xs mt-1" style={{ color: '#6B7280' }}>
                {filter.affectedCount.toLocaleString()} patients
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => {
              // TODO: Implement edit functionality
              console.log('Edit filter:', filter.id);
            }}
            className="p-1 transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F7E217')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
            title="Edit filter"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => removeFilter(filter.id)}
            className="p-1 transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF004D')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
            title="Remove filter"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
