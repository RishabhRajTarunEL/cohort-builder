import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export interface MultiSelectConfig {
  field: string;
  label: string;
  data_type: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected_values: string[];
  max_selections?: number;
  searchable?: boolean;
}

interface MultiSelectProps {
  config: MultiSelectConfig;
  operatorOptions?: Array<{ value: string; label: string }>;
  onChange: (operator: string, values: string[]) => void;
  disabled?: boolean;
}

export default function MultiSelect({ 
  config, 
  operatorOptions = [{ value: 'in', label: 'is any of' }], 
  onChange,
  disabled = false 
}: MultiSelectProps) {
  const [operator, setOperator] = useState(operatorOptions[0].value);
  const [selectedValues, setSelectedValues] = useState<string[]>(config.selected_values);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = config.searchable
    ? config.options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : config.options;

  const handleToggle = (value: string) => {
    let newValues: string[];
    
    if (selectedValues.includes(value)) {
      newValues = selectedValues.filter(v => v !== value);
    } else {
      if (config.max_selections && selectedValues.length >= config.max_selections) {
        return; // Don't allow more selections
      }
      newValues = [...selectedValues, value];
    }
    
    setSelectedValues(newValues);
    onChange(operator, newValues);
  };

  const handleRemove = (value: string) => {
    const newValues = selectedValues.filter(v => v !== value);
    setSelectedValues(newValues);
    onChange(operator, newValues);
  };

  const handleSelectAll = () => {
    const allValues = filteredOptions.map(opt => opt.value);
    setSelectedValues(allValues);
    onChange(operator, allValues);
  };

  const handleClearAll = () => {
    setSelectedValues([]);
    onChange(operator, []);
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

      {/* Search Box */}
      {config.searchable && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
          />
        </div>
      )}

      {/* Selected Values */}
      {selectedValues.length > 0 && (
        <div className="mb-3 p-2 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">
              Selected ({selectedValues.length})
            </span>
            <button
              onClick={handleClearAll}
              disabled={disabled}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedValues.map(value => {
              const option = config.options.find(opt => opt.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#06B6D4] text-white text-xs rounded-full"
                >
                  {option?.label || value}
                  <button
                    onClick={() => handleRemove(value)}
                    disabled={disabled}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          <>
            <div className="flex justify-end mb-2">
              <button
                onClick={handleSelectAll}
                disabled={disabled}
                className="text-xs text-[#06B6D4] hover:underline"
              >
                Select all visible
              </button>
            </div>
            {filteredOptions.map(option => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#06B6D4] bg-opacity-10'
                      : 'hover:bg-gray-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(option.value)}
                      disabled={disabled}
                      className="w-4 h-4 rounded border-gray-300 text-[#06B6D4] focus:ring-[#06B6D4]"
                    />
                    <span className="text-sm text-gray-700 truncate">
                      {option.label}
                    </span>
                  </div>
                  {option.count !== undefined && (
                    <span className="text-xs text-gray-400 ml-2">
                      ({option.count})
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#06B6D4] ml-2 flex-shrink-0" />
                  )}
                </label>
              );
            })}
          </>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">
            No options found
          </div>
        )}
      </div>

      {/* Max selections warning */}
      {config.max_selections && selectedValues.length >= config.max_selections && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          Maximum {config.max_selections} selections allowed
        </div>
      )}
    </div>
  );
}
