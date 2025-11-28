'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFilters } from '@/app/contexts/FilterContext';
import CohortStats from './CohortStats';
import DemographicsChart from './DemographicsChart';
import { DemographicsData, DiagnosisData } from '@/app/lib/types';
import { BarChart3 } from 'lucide-react';
import { saveCohort } from '@/app/lib/cohortStorage';

interface RightPanelProps {
  projectId?: string;
}

export default function RightPanel({ projectId }: RightPanelProps) {
  const router = useRouter();
  const { filters, cohortCount } = useFilters();
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [filters]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Get enabled filters
      const enabledFilters = filters.filter(f => f.enabled);

      // Fetch demographics data
      const demResponse = await fetch('/api/analytics/demographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: enabledFilters }),
      });

      if (demResponse.ok) {
        const demData = await demResponse.json();
        setDemographics(demData);
      }

      // Fetch diagnosis data
      const diagResponse = await fetch('/api/analytics/diagnoses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: enabledFilters }),
      });

      if (diagResponse.ok) {
        const diagData = await diagResponse.json();
        setDiagnoses(diagData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <h2 className="text-lg font-semibold text-gray-800">Cohort Analytics</h2>
        <p className="text-xs text-gray-500 mt-1">Real-time statistics</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <CohortStats count={cohortCount} loading={loading} />

        {/* Save & Analyze Button */}
        <button
          onClick={() => {
            const cohortId = Date.now().toString();
            // Save the cohort data before navigating
            saveCohort(cohortId, filters, cohortCount);
            router.push(`/analyze/${cohortId}`);
          }}
          disabled={cohortCount === 0 || loading}
          className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: cohortCount === 0 ? '#6B7280' : 'linear-gradient(135deg, #06B6D4 0%, #111827 100%)',
          }}
        >
          <BarChart3 className="w-5 h-5" />
          Save & Analyze Cohort
        </button>

        {demographics && (
          <>
            <DemographicsChart
              title="Gender Distribution"
              data={demographics.gender_distribution}
              loading={loading}
            />
            <DemographicsChart
              title="Age Distribution"
              data={demographics.age_distribution}
              loading={loading}
            />
          </>
        )}

        {diagnoses && (
          <DemographicsChart
            title="Top Diagnoses"
            data={diagnoses}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
