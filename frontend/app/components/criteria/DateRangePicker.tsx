import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRangeConfig {
  field: string;
  label: string;
  data_type: string;
  min_date?: string;
  max_date?: string;
  current_operator: string;
  current_value: string | string[];
}

export interface OperatorOption {
  value: string;
  label: string;
  requires: 'single_date' | 'date_range';
}

interface DateRangePickerProps {
  config: DateRangeConfig;
  operatorOptions: OperatorOption[];
  onChange: (operator: string, value: string | string[]) => void;
  disabled?: boolean;
}

export default function DateRangePicker({ 
  config, 
  operatorOptions, 
  onChange,
  disabled = false 
}: DateRangePickerProps) {
  const [operator, setOperator] = useState(config.current_operator);
  const [value, setValue] = useState<string | string[]>(config.current_value);

  const selectedOption = operatorOptions.find(opt => opt.value === operator);
  const isRange = selectedOption?.requires === 'date_range';

  const handleOperatorChange = (newOperator: string) => {
    const newOption = operatorOptions.find(opt => opt.value === newOperator);
    setOperator(newOperator);

    // Convert value type based on new operator
    if (newOption?.requires === 'date_range' && !Array.isArray(value)) {
      const today = new Date().toISOString().split('T')[0];
      setValue([value as string || today, today]);
    } else if (newOption?.requires === 'single_date' && Array.isArray(value)) {
      setValue(value[0]);
    }

    onChange(newOperator, value);
  };

  const handleDateChange = (newValue: string, index?: number) => {
    let updatedValue: string | string[];

    if (isRange && Array.isArray(value)) {
      updatedValue = [...value];
      if (index === 0) {
        updatedValue[0] = newValue;
        // Ensure start date is not after end date
        if (updatedValue[1] && new Date(newValue) > new Date(updatedValue[1])) {
          updatedValue[1] = newValue;
        }
      } else if (index === 1) {
        updatedValue[1] = newValue;
        // Ensure end date is not before start date
        if (updatedValue[0] && new Date(newValue) < new Date(updatedValue[0])) {
          updatedValue[0] = newValue;
        }
      }
    } else {
      updatedValue = newValue;
    }

    setValue(updatedValue);
    onChange(operator, updatedValue);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      {/* Header */}
      <div className="mb-3">
        <p className="text-xs text-gray-500">{config.field}</p>
      </div>

      {/* Operator Selector */}
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap">
          {operatorOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleOperatorChange(option.value)}
              disabled={disabled}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                operator === option.value
                  ? 'bg-[#06B6D4] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Inputs */}
      {isRange && Array.isArray(value) ? (
        <div className="space-y-3">
          {/* Start Date */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={value[0] || ''}
                onChange={(e) => handleDateChange(e.target.value, 0)}
                min={config.min_date}
                max={config.max_date}
                disabled={disabled}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {value[0] && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(value[0])}
              </p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={value[1] || ''}
                onChange={(e) => handleDateChange(e.target.value, 1)}
                min={config.min_date}
                max={config.max_date}
                disabled={disabled}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {value[1] && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(value[1])}
              </p>
            )}
          </div>

          {/* Duration Display */}
          {value[0] && value[1] && (
            <div className="p-2 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-600">
                Duration: {Math.ceil((new Date(value[1]).getTime() - new Date(value[0]).getTime()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={value as string || ''}
              onChange={(e) => handleDateChange(e.target.value)}
              min={config.min_date}
              max={config.max_date}
              disabled={disabled}
              className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {value && (
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(value as string)}
            </p>
          )}
        </div>
      )}

      {/* Quick Presets for Range */}
      {isRange && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Quick select:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last 90 days', days: 90 },
              { label: 'Last year', days: 365 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => {
                  const end = new Date().toISOString().split('T')[0];
                  const start = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0];
                  handleDateChange(start, 0);
                  handleDateChange(end, 1);
                }}
                disabled={disabled}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
