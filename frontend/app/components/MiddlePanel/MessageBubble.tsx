'use client';

import React from 'react';
import { Message, Filter } from '@/app/lib/types';
import { User, Bot, AlertCircle, Plus } from 'lucide-react';
import Tag from '@/app/components/ui/Tag';

interface MessageBubbleProps {
  message: Message;
  onApplyFilters: (filters: Filter[]) => void;
}

export default function MessageBubble({ message, onApplyFilters }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAgent = message.role === 'agent';
  const isSystem = message.role === 'system';

  const applyAllFilters = () => {
    if (message.suggestedFilters && message.suggestedFilters.length > 0) {
      onApplyFilters(message.suggestedFilters);
    }
  };

  const applyFilter = (filter: Filter) => {
    onApplyFilters([filter]);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-1">
          {isAgent && (
            <>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#24CF3540' }}
              >
                <Bot className="w-4 h-4" style={{ color: '#06B6D4' }} />
              </div>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                AI Assistant
              </span>
            </>
          )}
          {isUser && (
            <>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                You
              </span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#06B6D440' }}
              >
                <User className="w-4 h-4" style={{ color: '#06B6D4' }} />
              </div>
            </>
          )}
          {isSystem && (
            <>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#F7E21740' }}
              >
                <AlertCircle className="w-4 h-4" style={{ color: '#F7E217' }} />
              </div>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                System
              </span>
            </>
          )}
        </div>

        {/* Message Content */}
        <div
          className="p-3 rounded-lg"
          style={{
            backgroundColor: isUser
              ? '#06B6D4'
              : isSystem
                ? '#F7E21720'
                : '#f5f5f5',
            color: isUser ? 'white' : '#111827',
            border: isSystem ? '1px solid #F7E217' : 'none',
          }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {/* Suggested Filters */}
          {message.suggestedFilters && message.suggestedFilters.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: '#111827' }}>
                  Suggested Filters:
                </p>
                <button
                  onClick={applyAllFilters}
                  className="text-xs px-3 py-1 text-white rounded-full transition-colors"
                  style={{ backgroundColor: '#06B6D4' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111827')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#06B6D4')}
                >
                  Apply All
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {message.suggestedFilters.map((filter, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white border rounded-lg transition-colors"
                    style={{ borderColor: '#6B728040' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#06B6D4')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#6B728040')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag
                            variant={filter.type === 'include' ? 'purple' : 'orange'}
                            style="dark"
                            size="sm"
                          >
                            {filter.type === 'include' ? 'INCLUDE' : 'EXCLUDE'}
                          </Tag>
                        </div>
                        <p className="text-xs font-medium break-words" style={{ color: '#111827' }}>
                          {filter.text}
                        </p>
                        <p className="text-[10px] mt-1 font-mono break-all" style={{ color: '#6B7280' }}>
                          {filter.revised_criterion}
                        </p>
                      </div>
                      <button
                        onClick={() => applyFilter(filter)}
                        className="flex-shrink-0 p-1.5 rounded transition-colors"
                        style={{ backgroundColor: '#24CF3540', color: '#06B6D4' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#24CF35')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#24CF3540')}
                        title="Apply this filter"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
