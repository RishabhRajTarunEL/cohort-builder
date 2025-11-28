'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Filter } from '@/app/lib/types';

interface FilterContextType {
  filters: Filter[];
  cohortCount: number;
  addFilter: (filter: Filter) => void;
  addFilters: (filters: Filter[]) => void;
  removeFilter: (id: string) => void;
  toggleFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<Filter>) => void;
  clearFilters: () => void;
  loading: boolean;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [cohortCount, setCohortCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Update cohort count whenever filters change
  useEffect(() => {
    updateCohortCount();
  }, [filters]);

  const updateCohortCount = async () => {
    setLoading(true);
    try {
      // Get enabled filters
      const enabledFilters = filters.filter(f => f.enabled);

      // Call backend API to get updated count
      const response = await fetch('/api/filters/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: enabledFilters }),
      });

      if (response.ok) {
        const data = await response.json();
        setCohortCount(data.patient_count);
      }
    } catch (error) {
      console.error('Error updating cohort count:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFilter = (filter: Filter) => {
    setFilters(prev => [...prev, filter]);
  };

  const addFilters = (newFilters: Filter[]) => {
    setFilters(prev => [...prev, ...newFilters]);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const toggleFilter = (id: string) => {
    setFilters(prev =>
      prev.map(f => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const clearFilters = () => {
    setFilters([]);
    setCohortCount(0);
  };

  return (
    <FilterContext.Provider
      value={{
        filters,
        cohortCount,
        addFilter,
        addFilters,
        removeFilter,
        toggleFilter,
        updateFilter,
        clearFilters,
        loading,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
