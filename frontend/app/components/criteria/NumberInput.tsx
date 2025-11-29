import React, { useState } from 'react';

export interface NumberInputConfig {
  field: string;
  label: string;
  data_type: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  current_operator: string;
  current_value: number | number[];
}

export interface OperatorOption {
  value: string;
  label: string;
  requires: 'single_value' | 'range';
}

interface NumberInputProps {
  config: NumberInputConfig;
  operatorOptions: OperatorOption[];
  onChange: (operator: string, value: number | number[]) => void;
  disabled?: boolean;
}

export default function NumberInput({ 
  config, 
  operatorOptions, 
  onChange,
  disabled = false 
}: NumberInputProps) {
  const [operator, setOperator] = useState(config.current_operator);
  const [value, setValue] = useState<number | number[]>(config.current_value);

  const selectedOption = operatorOptions.find(opt => opt.value === operator);
  const isRange = selectedOption?.requires === 'range';

  const handleOperatorChange = (newOperator: string) => {
    const newOption = operatorOptions.find(opt => opt.value === newOperator);
    setOperator(newOperator);

    // Convert value type based on new operator
    if (newOption?.requires === 'range' && !Array.isArray(value)) {
      setValue([0, value as number]);
    } else if (newOption?.requires === 'single_value' && Array.isArray(value)) {
      setValue(value[0]);
    }

    onChange(newOperator, value);
  };

  const handleValueChange = (newVal: string, index?: number) => {
    const numVal = parseFloat(newVal) || 0;

    let updatedValue: number | number[];
    if (isRange && Array.isArray(value)) {
      updatedValue = [...value];
      if (index === 0) {
        updatedValue[0] = numVal;
      } else if (index === 1) {
        updatedValue[1] = numVal;
      }
    } else {
      updatedValue = numVal;
    }

    setValue(updatedValue);
    onChange(operator, updatedValue);
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

      {/* Number Inputs */}
      {isRange && Array.isArray(value) ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Min</label>
            <div className="relative">
              <input
                type="number"
                value={value[0]}
                onChange={(e) => handleValueChange(e.target.value, 0)}
                min={config.min}
                max={config.max}
                step={config.step || 1}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
              />
              {config.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {config.unit}
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Max</label>
            <div className="relative">
              <input
                type="number"
                value={value[1]}
                onChange={(e) => handleValueChange(e.target.value, 1)}
                min={config.min}
                max={config.max}
                step={config.step || 1}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
              />
              {config.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {config.unit}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-600 mb-1">Value</label>
          <div className="relative">
            <input
              type="number"
              value={value as number}
              onChange={(e) => handleValueChange(e.target.value)}
              min={config.min}
              max={config.max}
              step={config.step || 1}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
            />
            {config.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {config.unit}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
