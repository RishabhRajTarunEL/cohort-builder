'use client';

import React from 'react';
import { CriteriaChips } from '@/app/components/criteria';
import DynamicCriterionComponent from '@/app/components/criteria/DynamicCriterionComponent';
import Tag from '@/app/components/ui/Tag';
import { Button } from '@/app/components/ui';

interface ProgressiveCriteriaLayoutProps {
  criteria?: any[];
  fieldMappings?: any[];
  conceptMappings?: any[];
  stage?: number;
  onValueChange?: (criterionId: string, entity: string, operator: string, value: any) => void;
  onFieldMappingChange?: (mappingIndex: number, selectedField: string) => void;
  onApplyFieldMappings?: (mappings: any[]) => void;
  fieldMappingChanges?: { [key: string]: string };
  disabled?: boolean;
}

export default function ProgressiveCriteriaLayout({
  criteria = [],
  fieldMappings = [],
  conceptMappings = [],
  stage = 0,
  onValueChange,
  onFieldMappingChange,
  onApplyFieldMappings,
  fieldMappingChanges = {},
  disabled = false,
}: ProgressiveCriteriaLayoutProps) {
  // Determine which columns to show based on stage
  const showFieldMapping = stage >= 1;
  const showConceptMapping = stage >= 2;

  const hasFieldMappingChanges = Object.keys(fieldMappingChanges).length > 0;

  // Group field mappings by entity/criterion
  const getFieldMappingForCriterion = (criterion: any) => {
    // First, try to find in the separate fieldMappings array
    const entities = Object.keys(criterion.db_mappings || {});
    if (entities.length === 0) return null;
    
    // Find matching field mapping by entity in the fieldMappings array
    let mapping = fieldMappings.find((m: any) => 
      entities.some(entity => 
        entity.toLowerCase() === m.entity?.toLowerCase() ||
        criterion.text?.toLowerCase().includes(m.entity?.toLowerCase() || '')
      )
    );
    
    // If not found in fieldMappings array, extract from criterion's db_mappings
    if (!mapping && entities.length > 0) {
      const firstEntity = entities[0];
      const dbMapping = criterion.db_mappings[firstEntity];
      
      if (dbMapping && dbMapping['table.field']) {
        // Create a field mapping object from the db_mapping
        const tableField = dbMapping['table.field'];
        const rankedMatches = dbMapping.ranked_matches || [tableField];
        
        mapping = {
          entity: firstEntity,
          selected: tableField,
          options: rankedMatches,
          attribute: dbMapping.attribute || firstEntity,
          criterion_text: criterion.text,
          field_description: dbMapping.field_description || '',
        };
      }
    }
    
    return mapping;
  };

  if (criteria.length === 0) {
    return (
      <div className="w-full my-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="text-center py-8 text-gray-500 text-sm">
            No criteria extracted yet
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 space-y-4">
      {criteria.map((criterion: any, criterionIdx: number) => {
        const criterionId = criterion.id || `criterion-${criterionIdx}`;
        const fieldMapping = getFieldMappingForCriterion(criterion);
        const hasConceptMapping = Object.values(criterion.db_mappings || {}).some(
          (m: any) => m.ui_component
        );

        const isInclude = criterion.type === 'include';
        const bgColor = isInclude ? 'bg-purple-50' : 'bg-orange-50';
        const borderColor = isInclude ? 'border-purple-200' : 'border-orange-200';
        
        return (
          <div key={criterionId} className={`flex ${bgColor} border ${borderColor} rounded-lg shadow-sm overflow-hidden`}>
            <div className="flex">
              {/* Left Column: Criterion */}
              <div className="md:col-span-1 p-4">
                <h4 className={`text-sm font-semibold ${isInclude ? 'text-purple-900' : 'text-orange-900'} mb-3 flex items-center gap-2`}>
                  <span className={`w-2 h-2 ${isInclude ? 'bg-purple-500' : 'bg-orange-500'} rounded-full`}></span>
                  Criterion
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag
                      variant={isInclude ? 'purple' : 'orange'}
                      style="dark"
                      size="sm"
                    >
                      {isInclude ? 'INCLUDE' : 'EXCLUDE'}
                    </Tag>
                  </div>
                  <p className={`text-sm font-medium ${isInclude ? 'text-purple-900' : 'text-orange-900'} break-words`}>{criterion.text}</p>
                </div>
              </div>

              {/* Middle Column: Field Mapping (Stage 1+) */}
              {showFieldMapping && (
                <div className="md:col-span-1 p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Field Mapping
                  </h4>
                  {fieldMapping ? (
                    <div className="space-y-3">
                      {(() => {
                        const mappingIdx = fieldMappings.indexOf(fieldMapping);
                        const changeKey = `mapping_${mappingIdx}`;
                        const currentValue = fieldMappingChanges[changeKey] || fieldMapping.selected;
                        const isChanged = fieldMappingChanges[changeKey] && fieldMappingChanges[changeKey] !== fieldMapping.selected;
                        
                        return (
                          <div className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="mb-2">
                              <span className="text-xs font-medium text-gray-500 uppercase">Entity:</span>
                              <span className="ml-2">
                                <Tag variant="blue" style="light" size="sm">
                                  {fieldMapping.entity}
                                </Tag>
                              </span>
                              {isChanged && (
                                <span className="ml-2">
                                  <Tag variant="teal" style="light" size="sm">
                                    Modified
                                  </Tag>
                                </span>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Select Database Field:
                              </label>
                              <select 
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                value={currentValue}
                                onChange={(e) => {
                                  if (onFieldMappingChange) {
                                    onFieldMappingChange(mappingIdx, e.target.value);
                                  }
                                }}
                                disabled={disabled}
                              >
                                {(fieldMapping.options || []).map((option: string) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-blue-600 text-sm">
                      Field mapping will appear here
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: Concept Mapping (Stage 2+) */}
              {showConceptMapping && (
                <div className="md:col-span-1 p-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Concept Mapping
                  </h4>
                  {hasConceptMapping ? (
                    <div className="space-y-2">
                      <DynamicCriterionComponent
                        criterion={criterion}
                        onValueChange={onValueChange || (() => {})}
                        disabled={disabled}
                        hideHeader={true}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-green-600 text-sm">
                      Concept mapping will appear here
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Apply Changes Button - Show if there are any field mapping changes */}
      {hasFieldMappingChanges && onApplyFieldMappings && fieldMappings.length > 0 && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="primary"
            onClick={() => onApplyFieldMappings(fieldMappings)}
            disabled={disabled}
            size="sm"
          >
            Apply Changes
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (onFieldMappingChange) {
                fieldMappings.forEach((mapping: any, idx: number) => {
                  if (mapping.selected) {
                    onFieldMappingChange(idx, mapping.selected);
                  }
                });
              }
            }}
            disabled={disabled}
            size="sm"
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

