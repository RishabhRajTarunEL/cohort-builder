import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownConfig {
  field: string;
  label: string;
  data_type: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected_value: string;
}

interface DropdownProps {
  config: DropdownConfig;
  operatorOptions?: Array<{ value: string; label: string }>;
  onChange: (operator: string, value: string) => void;
  disabled?: boolean;
}

export default function Dropdown({ 
  config, 
  operatorOptions = [{ value: 'equals', label: 'is' }], 
  onChange,
  disabled = false 
}: DropdownProps) {
  const [operator, setOperator] = useState(operatorOptions[0].value);
  const [selectedValue, setSelectedValue] = useState(config.selected_value);

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue);
    onChange(operator, newValue);
  };

  const selectedOption = config.options.find(opt => opt.value === selectedValue);

  return (
    <div className="p-4 border rounded-lg bg-white">
      {/* Header */}
      <div className="mb-3">
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

      {/* Dropdown */}
      <div className="relative">
        <select
          value={selectedValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent cursor-pointer"
        >
          <option value="">Select an option...</option>
          {config.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.count !== undefined ? ` (${option.count})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Selected Value Display */}
      {selectedValue && selectedOption && (
        <div className="mt-3 p-2 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            Selected: <span className="font-medium text-gray-700">{selectedOption.label}</span>
          </p>
        </div>
      )}
    </div>
  );
}
