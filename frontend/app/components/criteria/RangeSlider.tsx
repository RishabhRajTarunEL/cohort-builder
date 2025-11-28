import React, { useState, useEffect } from 'react';

export interface RangeSliderConfig {
  field: string;
  label: string;
  data_type: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default_value: number | number[];
  current_operator: string;
  current_value: number | number[];
  marks?: { [key: string]: string };
  validation?: {
    min_required?: boolean;
    max_required?: boolean;
  };
}

export interface OperatorOption {
  value: string;
  label: string;
  requires: 'single_value' | 'range';
}

interface RangeSliderProps {
  config: RangeSliderConfig;
  operatorOptions: OperatorOption[];
  onChange: (operator: string, value: number | number[]) => void;
  disabled?: boolean;
}

export default function RangeSlider({ 
  config, 
  operatorOptions, 
  onChange,
  disabled = false 
}: RangeSliderProps) {
  const [operator, setOperator] = useState(config.current_operator);
  const [value, setValue] = useState<number | number[]>(config.current_value);

  const selectedOption = operatorOptions.find(opt => opt.value === operator);
  const isRange = selectedOption?.requires === 'range';

  useEffect(() => {
    onChange(operator, value);
  }, [operator, value]);

  const handleOperatorChange = (newOperator: string) => {
    const newOption = operatorOptions.find(opt => opt.value === newOperator);
    setOperator(newOperator);

    // Convert value type based on new operator
    if (newOption?.requires === 'range' && !Array.isArray(value)) {
      setValue([config.min, value as number]);
    } else if (newOption?.requires === 'single_value' && Array.isArray(value)) {
      setValue(value[0]);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const newVal = parseFloat(e.target.value);

    if (isRange && Array.isArray(value)) {
      const newRange = [...value];
      if (index === 0) {
        newRange[0] = Math.min(newVal, newRange[1]);
      } else if (index === 1) {
        newRange[1] = Math.max(newVal, newRange[0]);
      }
      setValue(newRange);
    } else {
      setValue(newVal);
    }
  };

  const formatValue = (val: number) => {
    return `${val}${config.unit ? ' ' + config.unit : ''}`;
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
      <div className="mb-4">
        <div className="flex gap-2">
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

      {/* Slider */}
      {isRange && Array.isArray(value) ? (
        <div className="space-y-4">
          {/* Min Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Min:</span>
              <span className="font-medium">{formatValue(value[0])}</span>
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value[0]}
              onChange={(e) => handleSliderChange(e, 0)}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
            />
          </div>

          {/* Max Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Max:</span>
              <span className="font-medium">{formatValue(value[1])}</span>
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value[1]}
              onChange={(e) => handleSliderChange(e, 1)}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Value:</span>
            <span className="font-medium">{formatValue(value as number)}</span>
          </div>
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value as number}
            onChange={handleSliderChange}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
          />
        </div>
      )}

      {/* Range Indicators */}
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>{formatValue(config.min)}</span>
        <span>{formatValue(config.max)}</span>
      </div>

      {/* Marks */}
      {config.marks && (
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          {Object.entries(config.marks).map(([key, label]) => (
            <span key={key}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
