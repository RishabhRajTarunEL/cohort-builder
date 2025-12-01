import { DatabaseTable, Filter } from './types';

// Mock database schema
export const mockDatabaseSchema: DatabaseTable[] = [
  {
    name: 'patient',
    record_count: 10000,
    columns: [
      { name: 'patient_id', type: 'integer', nullable: false },
      { name: 'age', type: 'integer', min: 18, max: 95 },
      { name: 'gender', type: 'varchar', values: ['Male', 'Female'] },
      {
        name: 'self_reported_race',
        type: 'varchar',
        values: ['Asian', 'White', 'Black', 'PacificIslander', 'Multiracial'],
      },
      {
        name: 'self_reported_ethnicity',
        type: 'varchar',
        values: ['Hispanic', 'Non-Hispanic'],
      },
      {
        name: 'prior_malignancy',
        type: 'varchar',
        values: ['Breast Cancer', 'Lung Cancer', 'Colorectal Cancer', 'Prostate Cancer', 'None'],
      },
    ],
  },
  {
    name: 'sample',
    record_count: 12500,
    columns: [
      { name: 'sample_id', type: 'integer', nullable: false, min: 1, max: 12500 },
      { name: 'patient_id', type: 'integer', nullable: false, min: 1, max: 10000 },
      {
        name: 'dx_at_inclusion',
        type: 'varchar',
        values: [
          'Acute Myeloid Leukemia',
          'Chronic Lymphocytic Leukemia',
          'Non-Hodgkin Lymphoma',
          'Multiple Myeloma',
          'Myelodysplastic Syndrome',
        ],
      },
      {
        name: 'specific_dx_at_inclusion',
        type: 'varchar',
        values: [
          'AML with mutated NPM1',
          'AML with mutated CEBPA',
          'CLL/SLL',
          'Diffuse Large B-Cell Lymphoma',
          'Follicular Lymphoma',
        ],
      },
      { name: 'collection_date', type: 'date', min: new Date('2015-01-01').getTime(), max: new Date('2024-12-31').getTime() },
    ],
  },
  {
    name: 'mutation',
    record_count: 250000,
    columns: [
      { name: 'mutation_id', type: 'integer', nullable: false, min: 1, max: 250000 },
      { name: 'sample_id', type: 'integer', nullable: false, min: 1, max: 12500 },
      {
        name: 'variant_classification',
        type: 'varchar',
        values: [
          'frameshift_variant',
          'missense_variant',
          'stop_gained',
          'inframe_deletion',
          'splice_acceptor_variant',
        ],
      },
      {
        name: 'existing_variation',
        type: 'varchar',
        values: [
          'rs121913227',
          'rs121913529',
          'rs587776767',
          'rs876658612',
          'None',
        ],
      },
      {
        name: 'biotype',
        type: 'varchar',
        values: [
          'protein_coding',
          'lncRNA',
          'processed_transcript',
          'nonsense_mediated_decay',
        ],
      },
      {
        name: 'gene_symbol',
        type: 'varchar',
        values: [
          'TP53',
          'KRAS',
          'EGFR',
          'BRAF',
          'PIK3CA',
          'BRCA1',
          'BRCA2',
          'ATM',
          'ALK',
          'RET',
        ],
      },
    ],
  },
];

// Function to simulate database query and return patient count
export function simulatePatientCount(filters: Filter[]): number {
  if (filters.length === 0) {
    return 10000; // Total database size
  }

  // Simple simulation: reduce count based on filter selectivity
  let count = 10000;
  const enabledFilters = filters.filter(f => f.enabled);

  for (const filter of enabledFilters) {
    if (filter.type === 'include') {
      // Simulate selectivity based on filter type
      if (filter.revised_criterion.includes('gender')) {
        count = Math.round(count * 0.5); // Gender is roughly 50/50
      } else if (filter.revised_criterion.includes('race')) {
        count = Math.round(count * 0.25); // Race specific
      } else if (filter.revised_criterion.includes('malignancy')) {
        count = Math.round(count * 0.15); // Disease specific
      } else if (filter.revised_criterion.includes('variant_classification')) {
        count = Math.round(count * 0.08); // Genetic mutation specific
      } else {
        count = Math.round(count * 0.3); // Default selectivity
      }
    } else {
      // Exclusion filters remove patients
      count = Math.round(count * 0.85);
    }
  }

  return Math.max(count, 0);
}

// Generate mock demographics data
export function generateDemographicsData(filters: Filter[]) {
  const totalPatients = simulatePatientCount(filters);

  // Gender distribution (roughly balanced but varies by filters)
  const hasGenderFilter = filters.some(
    f => f.enabled && f.revised_criterion.includes('gender')
  );

  let genderDistribution;
  if (hasGenderFilter) {
    const genderFilter = filters.find(
      f => f.enabled && f.revised_criterion.includes('gender')
    );
    if (genderFilter?.revised_criterion.includes('Female')) {
      genderDistribution = { Female: totalPatients, Male: 0 };
    } else if (genderFilter?.revised_criterion.includes('Male')) {
      genderDistribution = { Male: totalPatients, Female: 0 };
    } else {
      genderDistribution = {
        Female: Math.round(totalPatients * 0.52),
        Male: Math.round(totalPatients * 0.48),
      };
    }
  } else {
    genderDistribution = {
      Female: Math.round(totalPatients * 0.52),
      Male: Math.round(totalPatients * 0.48),
    };
  }

  // Age distribution
  const ageDistribution = {
    '18-30': Math.round(totalPatients * 0.12),
    '31-40': Math.round(totalPatients * 0.18),
    '41-50': Math.round(totalPatients * 0.22),
    '51-60': Math.round(totalPatients * 0.25),
    '61-70': Math.round(totalPatients * 0.15),
    '71+': Math.round(totalPatients * 0.08),
  };

  return {
    gender_distribution: genderDistribution,
    age_distribution: ageDistribution,
    total_patients: totalPatients,
  };
}

// Generate mock diagnosis data
export function generateDiagnosisData(filters: Filter[]) {
  const totalPatients = simulatePatientCount(filters);

  // Check if there's a diagnosis filter
  const hasDiagnosisFilter = filters.some(
    f => f.enabled && f.revised_criterion.includes('malignancy')
  );

  if (hasDiagnosisFilter) {
    const diagnosisFilter = filters.find(
      f => f.enabled && f.revised_criterion.includes('malignancy')
    );

    if (diagnosisFilter?.revised_criterion.includes('Breast Cancer')) {
      return { 'Breast Cancer': totalPatients };
    } else if (diagnosisFilter?.revised_criterion.includes('Lung Cancer')) {
      return { 'Lung Cancer': totalPatients };
    }
  }

  // Default distribution
  return {
    'Breast Cancer': Math.round(totalPatients * 0.28),
    'Lung Cancer': Math.round(totalPatients * 0.22),
    'Colorectal Cancer': Math.round(totalPatients * 0.18),
    'Prostate Cancer': Math.round(totalPatients * 0.15),
    'Other': Math.round(totalPatients * 0.12),
    'None': Math.round(totalPatients * 0.05),
  };
}

// Parse agent output and convert to Filter objects
export function parseAgentOutput(agentOutput: any): Filter[] {
  if (!agentOutput.criteria || !Array.isArray(agentOutput.criteria)) {
    return [];
  }

  return agentOutput.criteria.map((criterion: any, index: number) => ({
    id: `filter-${Date.now()}-${index}`,
    type: criterion.type === 'include' ? 'include' : 'exclude',
    text: criterion.text,
    entities: criterion.entities || [],
    db_mappings: criterion.db_mappings || {},
    revised_criterion: criterion.revised_criterion,
    enabled: true,
    affectedCount: simulatePatientCount([]), // This would be calculated properly in a real system
  }));
}
