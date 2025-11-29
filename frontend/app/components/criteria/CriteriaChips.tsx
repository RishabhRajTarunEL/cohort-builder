import { Plus, X } from 'lucide-react';

import Tag from '@/app/components/ui/Tag';

export interface Criterion {
  id: string;
  type: 'include' | 'exclude';
  text: string;
  chip: {
    label: string;
    category: string;
    color: string;
  };
}

interface CriteriaChipsProps {
  criteria: Criterion[];
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  editable?: boolean;
}

export default function CriteriaChips({ 
  criteria, 
  onDelete, 
  onAdd, 
  editable = true 
}: CriteriaChipsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {editable && onAdd && (
          <button
            onClick={onAdd}
            className="text-xs px-3 py-1.5 rounded-full bg-cyan text-white hover:bg-cyan-light transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Criterion
          </button>
        )}
      </div>

      <div className="space-y-2">
        {criteria.map(criterion => (
          <div
            key={criterion.id}
            className={`p-3 rounded-lg border transition-colors`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Type Badge */}
                <div className="mb-2">
                  <Tag
                    variant={criterion.type === 'include' ? 'purple' : 'orange'}
                    style="dark"
                    size="sm"
                  >
                    {criterion.type === 'include' ? 'INCLUDE' : 'EXCLUDE'}
                  </Tag>
                </div>

                {/* Criterion Text */}
                <p className="text-sm font-medium text-text mb-1">
                  {criterion.text}
                </p>

                {/* Chip */}
                <div className="flex items-center gap-2">
                  <Tag
                    variant={criterion.chip.color === 'blue' ? 'blue' : 'green'}
                    style="light"
                    size="sm"
                  >
                    {criterion.chip.label}
                  </Tag>
                  <span className="text-[10px] text-text-tertiary">
                    {criterion.chip.category}
                  </span>
                </div>
              </div>

              {/* Delete Button */}
              {editable && onDelete && (
                <button
                  onClick={() => onDelete(criterion.id)}
                  className="flex-shrink-0 p-1.5 rounded transition-colors hover:bg-error-bg text-error"
                  title="Delete criterion"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {criteria.length === 0 && (
        <div className="text-center py-8 text-text-tertiary text-sm">
          No criteria extracted yet
        </div>
      )}
    </div>
  );
}
