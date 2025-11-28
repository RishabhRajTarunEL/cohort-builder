import React, { useState } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxListConfig {
  field: string;
  label: string;
  data_type: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected_values: string[];
  allow_multiple?: boolean;
}

interface CheckboxListProps {
  config: CheckboxListConfig;
  operatorOptions?: Array<{ value: string; label: string }>;
  onChange: (operator: string, values: string[]) => void;
  disabled?: boolean;
}

export default function CheckboxList({ 
  config, 
  operatorOptions = [{ value: 'in', label: 'is any of' }], 
  onChange,
  disabled = false 
}: CheckboxListProps) {
  const [operator, setOperator] = useState(operatorOptions[0].value);
  const [selectedValues, setSelectedValues] = useState<string[]>(config.selected_values || []);

  const handleToggle = (value: string) => {
    let newValues: string[];
    
    if (config.allow_multiple === false) {
      // Single selection mode
      newValues = [value];
    } else {
      // Multiple selection mode
      if (selectedValues.includes(value)) {
        newValues = selectedValues.filter(v => v !== value);
      } else {
        newValues = [...selectedValues, value];
      }
    }
    
    setSelectedValues(newValues);
    onChange(operator, newValues);
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      {/* Header */}
      <div className="mb-3">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          {config.label}
        </label>
        <p className="text-xs text-gray-500">{config.field}</p>
      </div>

      {/* Operator Selector */}
      {operatorOptions.length > 1 && (
        <div className="mb-3">
          <div className="flex gap-2">
            {operatorOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setOperator(option.value)}
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
      )}

      {/* Checkbox Options */}
      <div className="grid grid-cols-1 gap-2">
        {config.options.map(option => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-[#06B6D4] bg-opacity-10 border-[#06B6D4]'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Custom Checkbox */}
              <div
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-[#06B6D4] border-[#06B6D4]'
                    : 'bg-white border-2 border-gray-300'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              {/* Hidden native checkbox for accessibility */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(option.value)}
                disabled={disabled}
                className="sr-only"
              />

              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700 font-medium">
                  {option.label}
                </span>
              </div>

              {/* Count Badge */}
              {option.count !== undefined && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {option.count}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedValues.length > 0 && (
        <div className="mt-3 p-2 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            {selectedValues.length} option{selectedValues.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}
