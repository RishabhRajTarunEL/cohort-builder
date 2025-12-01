'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldMappings } from '@/app/contexts/FieldMappingContext';
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
  const { fieldMappings, loadFieldMappings: loadMappings } = useFieldMappings();
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cohortCount, setCohortCount] = useState(1000);

  // Load field mappings when projectId is available
  useEffect(() => {
    if (projectId) {
      const projectIdNum = parseInt(projectId, 10);
      if (!isNaN(projectIdNum)) {
        loadMappings(projectIdNum).catch(err => {
          console.error('Failed to load field mappings:', err);
        });
      }
    }
  }, [projectId, loadMappings]);

  // Calculate applied filters count
  const appliedFiltersCount = useMemo(() => {
    return fieldMappings.filter(m => 
      m.source === 'user' || (m.source === 'agent' && m.status === 'applied')
    ).length;
  }, [fieldMappings]);

  // Update analytics when filters change
  useEffect(() => {
    updateAnalytics();
  }, [appliedFiltersCount, fieldMappings]);

  const updateAnalytics = async () => {
    setLoading(true);
    try {
      // Base dummy data - both Male and Female initially
      const baseDemographics: DemographicsData = {
        gender_distribution: {
          'Male': 520,
          'Female': 480
        },
        age_distribution: {
          '0-18': 100,
          '19-35': 250,
          '36-50': 300,
          '51-65': 250,
          '66+': 100
        },
        total_patients: 1000
      };

      const baseDiagnoses: DiagnosisData = {
        'Diabetes Type 2': 400,
        'Hypertension': 350,
        'Asthma': 200,
        'COPD': 150,
        'Heart Disease': 180,
        'Other': 120
      };

      // Calculate reduction factor based on number of filters applied
      // Each filter reduces the cohort by approximately 30-50%
      // With 0 filters: 100% of base
      // With 1 filter: ~60% of base
      // With 2 filters: ~35% of base
      // With 3+ filters: ~20% of base
      let reductionFactor = 1.0;
      if (appliedFiltersCount === 0) {
        reductionFactor = 1.0;
      } else if (appliedFiltersCount === 1) {
        reductionFactor = 0.6;
      } else if (appliedFiltersCount === 2) {
        reductionFactor = 0.35;
      } else {
        reductionFactor = Math.max(0.2, 1.0 - (appliedFiltersCount * 0.25));
      }

      // Apply reduction to all data
      const scaleValue = (value: number) => Math.round(value * reductionFactor);

      // If filters are applied, show only Male; otherwise show both
      const adjustedDemographics: DemographicsData = {
        gender_distribution: appliedFiltersCount > 0 
          ? {
              'Male': scaleValue(baseDemographics.gender_distribution.Male)
            }
          : {
              'Male': scaleValue(baseDemographics.gender_distribution.Male),
              'Female': scaleValue(baseDemographics.gender_distribution.Female)
            },
        age_distribution: {
          '0-18': scaleValue(baseDemographics.age_distribution['0-18']),
          '19-35': scaleValue(baseDemographics.age_distribution['19-35']),
          '36-50': scaleValue(baseDemographics.age_distribution['36-50']),
          '51-65': scaleValue(baseDemographics.age_distribution['51-65']),
          '66+': scaleValue(baseDemographics.age_distribution['66+'])
        },
        total_patients: appliedFiltersCount > 0
          ? scaleValue(baseDemographics.gender_distribution.Male)
          : scaleValue(baseDemographics.total_patients)
      };

      const adjustedDiagnoses: DiagnosisData = {
        'Diabetes Type 2': scaleValue(baseDiagnoses['Diabetes Type 2']),
        'Hypertension': scaleValue(baseDiagnoses['Hypertension']),
        'Asthma': scaleValue(baseDiagnoses['Asthma']),
        'COPD': scaleValue(baseDiagnoses['COPD']),
        'Heart Disease': scaleValue(baseDiagnoses['Heart Disease']),
        'Other': scaleValue(baseDiagnoses['Other'])
      };

      // Update cohort count
      setCohortCount(adjustedDemographics.total_patients);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      setDemographics(adjustedDemographics);
      setDiagnoses(adjustedDiagnoses);
    } catch (error) {
      console.error('Error updating analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <h2 className="text-lg font-semibold text-purple-500">Cohort Analytics</h2>
        <p className="text-xs text-gray-500 mt-1">Real-time statistics</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <CohortStats count={cohortCount} loading={loading} />

        {/* Save & Analyze Button */}
        <button
          onClick={() => {
            const cohortId = Date.now().toString();
            // Convert field mappings to filter format for saving
            const filters = fieldMappings
              .filter(m => m.source === 'user' || (m.source === 'agent' && m.status === 'applied'))
              .map(m => ({
                id: m.id.toString(),
                type: 'include' as const,
                text: m.display_text || `${m.table_name}.${m.field_name}`,
                entities: [m.concept || m.field_name],
                db_mappings: {
                  [m.concept || m.field_name]: {
                    entity_class: 'attribute',
                    'table.field': `${m.table_name}.${m.field_name}`,
                    ranked_matches: [],
                    mapped_concept: m.concept,
                    mapping_method: m.source === 'user' ? 'direct' : 'agent',
                  }
                },
                revised_criterion: m.sql_criterion,
                enabled: true,
              }));
            // Save the cohort data before navigating
            saveCohort(cohortId, filters, cohortCount);
            router.push(`/analyze/${cohortId}`);
          }}
          disabled={cohortCount === 0 || loading}
          className="w-full py-3 px-4 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-[#6B2FCC] hover:bg-[#5E22A6] active:bg-[#4D1A8C] disabled:bg-gray-300"
        >
          <BarChart3 className="w-5 h-5" />
          Save & Analyze Cohort
        </button>

        {demographics ? (
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
        ) : (
          loading && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Loading analytics...
            </div>
          )
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
