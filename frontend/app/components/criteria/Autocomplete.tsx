import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

export interface AutocompleteConfig {
  field: string;
  label: string;
  data_type: string;
  options?: Array<{ value: string; label: string; count?: number }>;
  suggestions?: { popular?: string[] };
  selected_values?: string[];
  placeholder?: string;
  allow_multiple?: boolean;
  min_search_length?: number;
}

interface AutocompleteProps {
  config: AutocompleteConfig;
  operatorOptions?: Array<{ value: string; label: string }>;
  onChange: (operator: string, values: string[]) => void;
  disabled?: boolean;
}

export default function Autocomplete({ 
  config, 
  operatorOptions = [{ value: 'in', label: 'is any of' }], 
  onChange,
  disabled = false 
}: AutocompleteProps) {
  const [operator, setOperator] = useState(operatorOptions[0].value);
  const [selectedValues, setSelectedValues] = useState<string[]>(config.selected_values || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const minSearchLength = config.min_search_length || 2;

  // Convert suggestions.popular array to options format if needed
  const normalizedOptions = useMemo((): Array<{ value: string; label: string; count?: number }> => {
    if (config.options && config.options.length > 0) {
      return config.options;
    }
    // Fallback to suggestions.popular if options not provided
    if (config.suggestions?.popular) {
      return config.suggestions.popular.map(val => ({
        value: val,
        label: val
      }));
    }
    return [];
  }, [config.options, config.suggestions]);

  // Filter options based on search
  const filteredOptions = searchQuery.length >= minSearchLength
    ? normalizedOptions.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : normalizedOptions.slice(0, 20); // Show first 20 by default

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    let newValues: string[];

    if (!config.allow_multiple) {
      newValues = [value];
      setIsOpen(false);
    } else {
      if (selectedValues.includes(value)) {
        newValues = selectedValues.filter(v => v !== value);
      } else {
        newValues = [...selectedValues, value];
      }
    }

    setSelectedValues(newValues);
    onChange(operator, newValues);
    setSearchQuery('');
  };

  const handleRemove = (value: string) => {
    const newValues = selectedValues.filter(v => v !== value);
    setSelectedValues(newValues);
    onChange(operator, newValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white" ref={wrapperRef}>
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

      {/* Selected Values */}
      {selectedValues.length > 0 && (
        <div className="mb-3 p-2 bg-gray-50 rounded-md">
          <div className="flex flex-wrap gap-1">
            {selectedValues.map(value => {
              const option = normalizedOptions.find(opt => opt.value === value);
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

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder || `Search ${config.label.toLowerCase()}...`}
            disabled={disabled}
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <ChevronDown 
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchQuery.length > 0 && searchQuery.length < minSearchLength && (
              <div className="p-3 text-xs text-gray-500 text-center">
                Type at least {minSearchLength} characters to search
              </div>
            )}

            {searchQuery.length >= minSearchLength && filteredOptions.length === 0 && (
              <div className="p-3 text-xs text-gray-500 text-center">
                No results found
              </div>
            )}

            {filteredOptions.map((option, index) => {
              const isSelected = selectedValues.includes(option.value);
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isHighlighted ? 'bg-gray-100' : ''
                  } ${isSelected ? 'bg-[#06B6D4] bg-opacity-10' : ''} hover:bg-gray-50`}
                >
                  <span className={isSelected ? 'font-medium text-[#06B6D4]' : 'text-gray-700'}>
                    {option.label}
                  </span>
                  {option.count !== undefined && (
                    <span className="text-xs text-gray-400">
                      ({option.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Helper Text */}
      {!isOpen && selectedValues.length === 0 && (
        <p className="mt-2 text-xs text-gray-400">
          {normalizedOptions.length} options available
        </p>
      )}
    </div>
  );
}
