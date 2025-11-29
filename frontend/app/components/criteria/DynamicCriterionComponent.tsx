import React from 'react';
import RangeSlider from './RangeSlider';
import NumberInput from './NumberInput';
import Dropdown from './Dropdown';
import MultiSelect from './MultiSelect';
import Autocomplete from './Autocomplete';
import DateRangePicker from './DateRangePicker';
import Toggle from './Toggle';
import CheckboxList from './CheckboxList';
import TextInput from './TextInput';
import Tag from '@/app/components/ui/Tag';

export interface CriterionWithUI {
  id: string;
  type: 'include' | 'exclude';
  text: string;
  db_mappings: {
    [entity: string]: {
      entity_class: string;
      'table.field': string;
      ui_component?: {
        type: string;
        config: any;
        operator_options?: any[];
      };
    };
  };
}

interface DynamicCriterionComponentProps {
  criterion: CriterionWithUI;
  onValueChange: (criterionId: string, entity: string, operator: string, value: any) => void;
  disabled?: boolean;
}

export default function DynamicCriterionComponent({ 
  criterion, 
  onValueChange,
  disabled = false 
}: DynamicCriterionComponentProps) {
  const entities = Object.entries(criterion.db_mappings);

  console.log('DynamicCriterionComponent - criterion:', criterion);
  console.log('DynamicCriterionComponent - entities:', entities);

  if (entities.length === 0) {
    return (
      <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
        <p className="text-sm text-amber-700">
          No database mappings found for this criterion
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Criterion Header */}
      <div className="p-3 bg-gray-50 border-l-4 border-[#06B6D4] rounded">
        <div className="flex items-center gap-2 mb-1">
          <Tag
            variant={criterion.type === 'include' ? 'purple' : 'orange'}
            style="dark"
            size="sm"
          >
            {criterion.type === 'include' ? 'INCLUDE' : 'EXCLUDE'}
          </Tag>
        </div>
        <p className="text-sm font-medium text-gray-700">{criterion.text}</p>
      </div>

      {/* Render UI component for each entity mapping */}
      {entities.map(([entity, mapping]) => {
        const uiComponent = mapping.ui_component;

        if (!uiComponent) {
          return (
            <div key={entity} className="p-4 border border-gray-200 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{entity}</span> → {mapping['table.field']}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                No UI component configured
              </p>
            </div>
          );
        }

        const handleChange = (operator: string, value: any) => {
          onValueChange(criterion.id, entity, operator, value);
        };

        // Render appropriate component based on type
        // Map backend component types to frontend components
        switch (uiComponent.type) {
          case 'range_slider':
            return (
              <RangeSlider
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options || []}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'number_input':
            return (
              <NumberInput
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options || []}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'dropdown':
          case 'dropdown_single':
            return (
              <Dropdown
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'multiselect':
          case 'multiselect_dropdown':
            return (
              <MultiSelect
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'autocomplete':
            return (
              <Autocomplete
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'date_range':
          case 'date_range_picker':
            return (
              <DateRangePicker
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options || []}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'toggle':
            return (
              <Toggle
                key={entity}
                config={uiComponent.config}
                onChange={(value) => handleChange('equals', value)}
                disabled={disabled}
              />
            );

          case 'checkbox_list':
            return (
              <CheckboxList
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          case 'text_input':
            return (
              <TextInput
                key={entity}
                config={uiComponent.config}
                operatorOptions={uiComponent.operator_options}
                onChange={handleChange}
                disabled={disabled}
              />
            );

          default:
            return (
              <div key={entity} className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">
                  Unknown component type: {uiComponent.type}
                </p>
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  Received: {JSON.stringify(uiComponent.type)}
                </p>
              </div>
            );
        }
      })}
    </div>
  );
}
