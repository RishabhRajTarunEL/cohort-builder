import React, { useState } from 'react';

export interface ToggleConfig {
  field: string;
  label: string;
  data_type: string;
  true_label?: string;
  false_label?: string;
  current_value: boolean;
}

interface ToggleProps {
  config: ToggleConfig;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ 
  config, 
  onChange,
  disabled = false 
}: ToggleProps) {
  const [value, setValue] = useState(config.current_value);

  const handleToggle = () => {
    const newValue = !value;
    setValue(newValue);
    onChange(newValue);
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

      {/* Toggle Switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm ${!value ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {config.false_label || 'No'}
          </span>
          <button
            onClick={handleToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 ${
              value ? 'bg-[#06B6D4]' : 'bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${value ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {config.true_label || 'Yes'}
          </span>
        </div>

        {/* Current State Badge */}
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            value 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {value ? (config.true_label || 'Yes') : (config.false_label || 'No')}
        </span>
      </div>
    </div>
  );
}
