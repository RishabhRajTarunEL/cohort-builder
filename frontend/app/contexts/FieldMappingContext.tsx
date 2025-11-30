'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchFieldMappings,
  createFieldMapping as apiCreateFieldMapping,
  updateFieldMapping as apiUpdateFieldMapping,
  deleteFieldMapping as apiDeleteFieldMapping,
  FieldMapping,
} from '@/app/lib/fieldMappingService';

interface FieldMappingContextType {
  fieldMappings: FieldMapping[];
  loading: boolean;
  error: string | null;
  
  // CRUD operations
  loadFieldMappings: (projectId: number, filters?: { status?: string; source?: string }) => Promise<void>;
  createFieldMapping: (projectId: number, mapping: any) => Promise<FieldMapping | null>;
  updateFieldMapping: (projectId: number, mappingId: string, updates: any) => Promise<FieldMapping | null>;
  deleteFieldMapping: (projectId: number, mappingId: string) => Promise<boolean>;
  
  // Filtering
  getUserMappings: () => FieldMapping[];
  getAgentMappings: () => FieldMapping[];
  getConfirmedMappings: () => FieldMapping[];
  getDraftMappings: () => FieldMapping[];
  
  // Real-time sync
  refreshMappings: () => Promise<void>;
}

const FieldMappingContext = createContext<FieldMappingContextType | undefined>(undefined);

export function FieldMappingProvider({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId?: number;
}) {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<number | undefined>(projectId);

  // Track project ID changes but don't auto-load
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      setCurrentProjectId(projectId);
      // Don't auto-load - components will call loadFieldMappings explicitly when needed
    }
  }, [projectId]);

  const loadFieldMappings = useCallback(
    async (projId: number, filters?: { status?: string; source?: string }) => {
      setLoading(true);
      setError(null);
      
      try {
        const mappings = await fetchFieldMappings(projId, filters);
        setFieldMappings(mappings);
      } catch (err) {
        console.error('Failed to load field mappings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load field mappings');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createFieldMapping = useCallback(
    async (projId: number, mapping: any): Promise<FieldMapping | null> => {
      try {
        const newMapping = await apiCreateFieldMapping(projId, mapping);
        setFieldMappings(prev => [...prev, newMapping]);
        return newMapping;
      } catch (err) {
        console.error('Failed to create field mapping:', err);
        setError(err instanceof Error ? err.message : 'Failed to create field mapping');
        return null;
      }
    },
    []
  );

  const updateFieldMapping = useCallback(
    async (projId: number, mappingId: string, updates: any): Promise<FieldMapping | null> => {
      try {
        const updatedMapping = await apiUpdateFieldMapping(projId, mappingId, updates);
        setFieldMappings(prev =>
          prev.map(m => (m.id === mappingId ? updatedMapping : m))
        );
        return updatedMapping;
      } catch (err) {
        console.error('Failed to update field mapping:', err);
        setError(err instanceof Error ? err.message : 'Failed to update field mapping');
        return null;
      }
    },
    []
  );

  const deleteFieldMapping = useCallback(
    async (projId: number, mappingId: string): Promise<boolean> => {
      try {
        await apiDeleteFieldMapping(projId, mappingId);
        setFieldMappings(prev => prev.filter(m => m.id !== mappingId));
        return true;
      } catch (err) {
        console.error('Failed to delete field mapping:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete field mapping');
        return false;
      }
    },
    []
  );

  const refreshMappings = useCallback(async () => {
    if (!currentProjectId) return;
    
    try {
      const mappings = await fetchFieldMappings(currentProjectId);
      setFieldMappings(mappings);
    } catch (err) {
      console.error('Failed to refresh field mappings:', err);
    }
  }, [currentProjectId]);

  // Filter helpers
  const getUserMappings = useCallback(() => {
    return fieldMappings.filter(m => m.source === 'user');
  }, [fieldMappings]);

  const getAgentMappings = useCallback(() => {
    return fieldMappings.filter(m => m.source === 'agent');
  }, [fieldMappings]);

  const getConfirmedMappings = useCallback(() => {
    return fieldMappings.filter(m => m.status === 'agent_confirmed' || m.status === 'applied');
  }, [fieldMappings]);

  const getDraftMappings = useCallback(() => {
    return fieldMappings.filter(m => m.status === 'draft');
  }, [fieldMappings]);

  const value: FieldMappingContextType = {
    fieldMappings,
    loading,
    error,
    loadFieldMappings,
    createFieldMapping,
    updateFieldMapping,
    deleteFieldMapping,
    getUserMappings,
    getAgentMappings,
    getConfirmedMappings,
    getDraftMappings,
    refreshMappings,
  };

  return (
    <FieldMappingContext.Provider value={value}>
      {children}
    </FieldMappingContext.Provider>
  );
}

export function useFieldMappings() {
  const context = useContext(FieldMappingContext);
  if (context === undefined) {
    throw new Error('useFieldMappings must be used within a FieldMappingProvider');
  }
  return context;
}
