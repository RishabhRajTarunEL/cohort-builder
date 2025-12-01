import { Filter } from './types';

export interface SavedCohort {
  id: string;
  filters: Filter[];
  cohortCount: number;
  savedAt: string;
}

export function saveCohort(cohortId: string, filters: Filter[], cohortCount: number): void {
  const cohort: SavedCohort = {
    id: cohortId,
    filters: filters.filter(f => f.enabled), // Only save enabled filters
    cohortCount,
    savedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(`cohort_${cohortId}`, JSON.stringify(cohort));
  }
}

export function getCohort(cohortId: string): SavedCohort | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(`cohort_${cohortId}`);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as SavedCohort;
  } catch (error) {
    console.error('Error parsing cohort data:', error);
    return null;
  }
}

export function getAllCohorts(): SavedCohort[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const cohorts: SavedCohort[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cohort_')) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          cohorts.push(JSON.parse(stored));
        } catch (error) {
          console.error('Error parsing cohort:', error);
        }
      }
    }
  }

  return cohorts.sort((a, b) =>
    new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export function deleteCohort(cohortId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`cohort_${cohortId}`);
  }
}
