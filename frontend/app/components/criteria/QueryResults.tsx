import React, { useState } from 'react';
import { Download, FileText, BarChart3 } from 'lucide-react';

interface QueryResultsProps {
  results: {
    total_count: number;
    columns: string[];
    preview: Array<{ [key: string]: any }>;
    gcs_path?: string;
  };
  queryId?: string;
  onDownload?: () => void;
  onVisualize?: () => void;
}

export default function QueryResults({ 
  results, 
  queryId,
  onDownload, 
  onVisualize 
}: QueryResultsProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 10;

  const totalPages = Math.ceil(results.preview.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = results.preview.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
        <div>
          <h3 className="text-lg font-semibold text-green-900">
            Query Executed Successfully
          </h3>
          <p className="text-sm text-green-700 mt-1">
            Found <span className="font-bold">{results.total_count}</span> matching records
          </p>
          {queryId && (
            <p className="text-xs text-green-600 mt-1">
              Query ID: {queryId}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {onVisualize && (
            <button
              onClick={onVisualize}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-green-300 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Visualize
            </button>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#06B6D4] text-white hover:bg-[#111827] rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        {/* Table Header */}
        <div className="bg-gray-50 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Preview ({results.preview.length} of {results.total_count} records)
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {results.columns.map((column, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                  {results.columns.map((column, colIdx) => (
                    <td key={colIdx} className="px-4 py-3 text-gray-700">
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : <span className="text-gray-400 italic">null</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Download Full Results Note */}
      {results.total_count > results.preview.length && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Only showing first {results.preview.length} records. 
            Download the full CSV to view all {results.total_count} results.
          </p>
        </div>
      )}
    </div>
  );
}
