'use client';

import React from 'react';
import { Users, Loader2 } from 'lucide-react';

interface CohortStatsProps {
  count: number;
  loading: boolean;
}

export default function CohortStats({ count, loading }: CohortStatsProps) {
  return (
    <div className="rounded-2xl p-6 bg-[#F5F0FB] border border-[#E8DDFF] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-700">Total Cohort Size</h3>
        <Users className="w-5 h-5 text-purple-600" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="text-2xl text-gray-800">Loading...</span>
        </div>
      ) : (
        <>
          <div className="text-4xl font-bold mb-2 text-gray-900">{count.toLocaleString()}</div>
          <div className="text-sm text-gray-600">patients in current cohort</div>
        </>
      )}
    </div>
  );
}
