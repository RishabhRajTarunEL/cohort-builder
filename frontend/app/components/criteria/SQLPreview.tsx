import React, { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';

interface SQLExplanation {
  tables_used?: string[];
  num_tables?: number;
  joins?: string[];
  filters?: string[];
  num_criteria?: number;
  estimated_results?: string;
}

interface SQLPreviewProps {
  sql: string;
  explanation?: string | SQLExplanation;
  validation?: {
    is_valid: boolean;
    errors?: string[];
    warnings?: string[];
  };
}

export default function SQLPreview({ sql, explanation, validation }: SQLPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-3">
      {/* Validation Status */}
      {validation && (
        <div
          className={`p-3 rounded-lg border ${
            validation.is_valid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-2 h-2 rounded-full ${
                validation.is_valid ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span
              className={`text-sm font-medium ${
                validation.is_valid ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {validation.is_valid ? 'Valid SQL Query' : 'Invalid SQL Query'}
            </span>
          </div>

          {validation.errors && validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((error, idx) => (
                <p key={idx} className="text-xs text-red-600">
                  • {error}
                </p>
              ))}
            </div>
          )}

          {validation.warnings && validation.warnings.length > 0 && (
            <div className="space-y-1 mt-2">
              {validation.warnings.map((warning, idx) => (
                <p key={idx} className="text-xs text-amber-600">
                  ⚠ {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SQL Code Block */}
      <div className="border rounded-lg overflow-hidden bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">SQL Query</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* SQL Content */}
        <div className="p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100 font-mono leading-relaxed">
            <code>{sql}</code>
          </pre>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Query Explanation
          </h4>
          {typeof explanation === 'string' ? (
            <p className="text-sm text-blue-700 whitespace-pre-line">
              {explanation}
            </p>
          ) : (
            <div className="space-y-3 text-sm text-blue-700">
              {explanation.num_tables !== undefined && (
                <div>
                  <span className="font-medium">Tables:</span> {explanation.num_tables} table(s)
                  {explanation.tables_used && explanation.tables_used.length > 0 && (
                    <span className="ml-1">
                      ({explanation.tables_used.join(', ')})
                    </span>
                  )}
                </div>
              )}
              
              {explanation.joins && explanation.joins.length > 0 && (
                <div>
                  <span className="font-medium">Joins:</span>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {explanation.joins.map((join, idx) => (
                      <li key={idx} className="text-xs">{join}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {explanation.filters && explanation.filters.length > 0 && (
                <div>
                  <span className="font-medium">Filters:</span> {explanation.filters.length} condition(s)
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {explanation.filters.map((filter, idx) => (
                      <li key={idx} className="text-xs">{filter}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {explanation.num_criteria !== undefined && (
                <div>
                  <span className="font-medium">Criteria Applied:</span> {explanation.num_criteria}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
