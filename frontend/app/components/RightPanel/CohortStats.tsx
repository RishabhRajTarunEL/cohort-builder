'use client';

import React from 'react';
import { Users, Loader2 } from 'lucide-react';

interface CohortStatsProps {
  count: number;
  loading: boolean;
}

export default function CohortStats({ count, loading }: CohortStatsProps) {
  return (
    <div
      className="rounded-lg p-6 text-white shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #06B6D4 0%, #111827 100%)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium opacity-90">Total Cohort Size</h3>
        <Users className="w-5 h-5 opacity-75" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-2xl">Loading...</span>
        </div>
      ) : (
        <>
          <div className="text-4xl font-bold mb-2">{count.toLocaleString()}</div>
          <div className="text-sm opacity-75">patients in current cohort</div>
        </>
      )}
    </div>
  );
}
