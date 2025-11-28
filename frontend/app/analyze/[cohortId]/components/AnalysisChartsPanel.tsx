'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Activity, Dna, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DemographicsChart from '@/app/components/RightPanel/DemographicsChart';
import { getCohort, SavedCohort } from '@/app/lib/cohortStorage';
import { generateDemographicsData, generateDiagnosisData } from '@/app/lib/mockData';

interface AnalysisChartsPanelProps {
  cohortId: string;
  generatedPlots?: any[];
}

export default function AnalysisChartsPanel({ cohortId, generatedPlots = [] }: AnalysisChartsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<SavedCohort | null>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [diagnoses, setDiagnoses] = useState<any>(null);

  useEffect(() => {
    // Load the saved cohort
    const savedCohort = getCohort(cohortId);

    if (!savedCohort) {
      setLoading(false);
      return;
    }

    setCohort(savedCohort);

    // Generate analytics based on filtered data
    const demData = generateDemographicsData(savedCohort.filters);
    const diagData = generateDiagnosisData(savedCohort.filters);

    setDemographics(demData);
    setDiagnoses(diagData);
    setLoading(false);
  }, [cohortId]);

  // Generate mutation frequency based on filtered cohort
  const mockMutationFrequency = cohort ? {
    TP53: Math.round(cohort.cohortCount * 0.25),
    KRAS: Math.round(cohort.cohortCount * 0.18),
    EGFR: Math.round(cohort.cohortCount * 0.15),
    BRAF: Math.round(cohort.cohortCount * 0.12),
    PIK3CA: Math.round(cohort.cohortCount * 0.09),
    BRCA1: Math.round(cohort.cohortCount * 0.07),
    BRCA2: Math.round(cohort.cohortCount * 0.065),
    ATM: Math.round(cohort.cohortCount * 0.05),
  } : {};

  if (!cohort && !loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <AlertCircle className="w-16 h-16 mb-4" style={{ color: '#6B7280' }} />
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#111827' }}>
          Cohort Not Found
        </h2>
        <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
          The cohort you're looking for doesn't exist or has expired.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 rounded-lg text-white"
          style={{ backgroundColor: '#06B6D4' }}
        >
          Back to Cohort Builder
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between" style={{ borderColor: '#6B7280' }}>
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#06B6D4' }} />
            </button>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
                Cohort Analysis
              </h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Cohort ID: {cohortId}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: '#06B6D4' }}>
            {cohort?.cohortCount.toLocaleString() || '0'}
          </div>
          <div className="text-xs" style={{ color: '#6B7280' }}>
            Filtered Patients
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Demographics Charts */}
          {demographics && (
            <>
              <div className="col-span-1">
                <DemographicsChart
                  title="Gender Distribution"
                  data={demographics.gender_distribution}
                  loading={loading}
                />
              </div>
              <div className="col-span-1">
                <DemographicsChart
                  title="Age Distribution"
                  data={demographics.age_distribution}
                  loading={loading}
                />
              </div>
            </>
          )}

          {/* Mutation Frequency Chart */}
          <div className="col-span-2">
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#6B728040' }}>
              <div className="flex items-center gap-2 mb-4">
                <Dna className="w-5 h-5" style={{ color: '#06B6D4' }} />
                <h3 className="font-semibold" style={{ color: '#111827' }}>
                  Top Mutated Genes
                </h3>
              </div>
              <div className="space-y-3">
                {Object.entries(mockMutationFrequency).map(([gene, count]) => {
                  const maxCount = Math.max(...Object.values(mockMutationFrequency));
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={gene}>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: '#111827' }}>{gene}</span>
                        <span style={{ color: '#6B7280' }}>{count} patients</span>
                      </div>
                      <div className="h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, #06B6D4 0%, #111827 100%)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Diagnosis Distribution */}
          {diagnoses && (
            <div className="col-span-1">
              <DemographicsChart
                title="Diagnosis Distribution"
                data={diagnoses}
                loading={loading}
              />
            </div>
          )}

          {/* Survival Curve Placeholder */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border p-6 h-full" style={{ borderColor: '#6B728040' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" style={{ color: '#06B6D4' }} />
                <h3 className="font-semibold" style={{ color: '#111827' }}>
                  Survival Curve
                </h3>
              </div>
              <div className="flex items-center justify-center h-64" style={{ color: '#6B7280' }}>
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Survival analysis coming soon</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Generated Analytics */}
          {generatedPlots.length > 0 ? (
            <>
              {/* Header for AI Generated Section */}
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5" style={{ color: '#06B6D4' }} />
                  <h3 className="font-semibold" style={{ color: '#111827' }}>
                    AI Generated Analytics
                  </h3>
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#06B6D440', color: '#111827' }}>
                    {generatedPlots.length} plot{generatedPlots.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* AI Generated Plots */}
              {generatedPlots.map((plot, idx) => (
                <div key={idx} className="col-span-1">
                  <DemographicsChart
                    title={plot.title}
                    data={plot.data}
                    loading={false}
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="col-span-2">
              <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#6B728040' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5" style={{ color: '#06B6D4' }} />
                  <h3 className="font-semibold" style={{ color: '#111827' }}>
                    Additional Analytics
                  </h3>
                </div>
                <div className="flex items-center justify-center h-48" style={{ color: '#6B7280' }}>
                  <div className="text-center">
                    <p className="text-sm">
                      Ask the AI to generate custom visualizations
                    </p>
                    <p className="text-xs mt-2 opacity-75">
                      Try: "Show me age distribution" or "Display mutation frequency"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
