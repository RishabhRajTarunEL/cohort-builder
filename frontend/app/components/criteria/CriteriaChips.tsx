import { Plus, X } from 'lucide-react';

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
        <h3 className="text-sm font-medium text-text-secondary">
          Extracted Criteria
        </h3>
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
            className={`p-3 rounded-lg border transition-colors ${
              criterion.type === 'include' 
                ? 'border-success bg-success-bg' 
                : 'border-error bg-error-bg'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Type Badge */}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mb-2 ${
                    criterion.type === 'include'
                      ? 'bg-success text-white'
                      : 'bg-error text-white'
                  }`}
                >
                  {criterion.type === 'include' ? 'INCLUDE' : 'EXCLUDE'}
                </span>

                {/* Criterion Text */}
                <p className="text-sm font-medium text-text mb-1">
                  {criterion.text}
                </p>

                {/* Chip */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-md ${
                      criterion.chip.color === 'blue'
                        ? 'bg-info-bg text-info'
                        : 'bg-warning-bg text-yellow'
                    }`}
                  >
                    {criterion.chip.label}
                  </span>
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
