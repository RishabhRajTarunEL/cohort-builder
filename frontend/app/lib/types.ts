// Filter types based on the agent output format
export interface Filter {
  id: string;
  type: 'include' | 'exclude';
  text: string;
  entities: string[];
  db_mappings: {
    [entity: string]: {
      entity_class: string;
      'table.field': string;
      ranked_matches: string[];
      mapped_concept?: string;
      mapping_method?: string;
      reason?: string | null;
      top_candidates?: string[];
    };
  };
  revised_criterion: string;
  enabled: boolean;
  affectedCount?: number;
}

// Message types for chat interface
export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  suggestedFilters?: Filter[];
}

// Database schema types
export interface DatabaseTable {
  name: string;
  record_count: number;
  columns: DatabaseColumn[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable?: boolean;
  min?: number;
  max?: number;
  values?: string[];
}

// Analytics/Chart data types
export interface DemographicsData {
  gender_distribution: { [key: string]: number };
  age_distribution: { [key: string]: number };
  total_patients: number;
}

export interface DiagnosisData {
  [diagnosis: string]: number;
}

// Cohort state
export interface CohortState {
  cohortId: string;
  patientCount: number;
  filters: Filter[];
}

// API Response types
export interface ChatQueryResponse {
  query_id: string;
  interpretation: string;
  suggested_filters: Filter[];
  requires_clarification: boolean;
}

export interface ApplyFiltersResponse {
  cohort_id: string;
  patient_count: number;
  filters_applied: number;
  execution_time_ms: number;
}
