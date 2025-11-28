import React, { useState } from 'react';

export interface TextInputConfig {
  field: string;
  label: string;
  data_type: string;
  current_value: string;
  placeholder?: string;
  suggestions?: string[];
  max_length?: number;
}

interface TextInputProps {
  config: TextInputConfig;
  operatorOptions?: Array<{ value: string; label: string }>;
  onChange: (operator: string, value: string) => void;
  disabled?: boolean;
}

export default function TextInput({ 
  config, 
  operatorOptions = [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
  ], 
  onChange,
  disabled = false 
}: TextInputProps) {
  const [operator, setOperator] = useState(operatorOptions[0].value);
  const [value, setValue] = useState(config.current_value);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = config.suggestions
    ? config.suggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase()) && s !== value
      )
    : [];

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(operator, newValue);
    setShowSuggestions(newValue.length > 0 && filteredSuggestions.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    onChange(operator, suggestion);
    setShowSuggestions(false);
  };

  const handleOperatorChange = (newOperator: string) => {
    setOperator(newOperator);
    onChange(newOperator, value);
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
      <div className="mb-3">
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

      {/* Text Input */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={config.placeholder || `Enter ${config.label.toLowerCase()}...`}
          maxLength={config.max_length}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
        />

        {/* Character Count */}
        {config.max_length && value.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {value.length}/{config.max_length}
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
            <div className="p-2 text-xs text-gray-500 border-b">
              Suggestions:
            </div>
            {filteredSuggestions.slice(0, 10).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors text-gray-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Value Display */}
      {value && (
        <div className="mt-2 p-2 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-600">
            Will match records where <span className="font-medium">{config.field}</span>{' '}
            <span className="font-medium text-[#06B6D4]">{operator.replace('_', ' ')}</span>{' '}
            &ldquo;<span className="font-medium">{value}</span>&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
