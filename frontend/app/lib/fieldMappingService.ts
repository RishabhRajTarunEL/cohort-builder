/**
 * Service for field mapping and lazy schema loading
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Get CSRF token from cookies
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

/**
 * Get headers with CSRF token
 */
function getHeaders(includeContentType: boolean = false): HeadersInit {
  const csrfToken = getCookie('csrftoken');
  const headers: HeadersInit = {};
  
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }
  
  return headers;
}

export interface TableInfo {
  table_name: string;
  table_description: string;
  field_count: number;
}

export interface FieldInfo {
  field_name: string;
  field_type: string;
  field_description: string;
  field_uniqueness_percent: number;
}

export interface FieldValue {
  value: any;
  count?: number;
}

export interface FieldMapping {
  id: string;
  cohort_project: number;
  user: number;
  source: 'user' | 'agent' | 'imported';
  status: 'draft' | 'pending_agent' | 'agent_confirmed' | 'applied';
  table_name: string;
  field_name: string;
  field_type: string;
  concept: string;
  operator: string;
  value: any;
  sql_criterion: string;
  display_text: string;
  agent_metadata: any;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch table list for a project (lazy load tier 1)
 */
export async function fetchProjectTables(projectId: number): Promise<TableInfo[]> {
  const response = await fetch(`${API_BASE_URL}/cohort-projects/${projectId}/table-schema`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tables: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.tables;
}

/**
 * Fetch fields for a specific table (lazy load tier 2)
 */
export async function fetchTableFields(
  projectId: number,
  tableName: string
): Promise<FieldInfo[]> {
  const response = await fetch(
    `${API_BASE_URL}/cohort-projects/${projectId}/tables/${encodeURIComponent(tableName)}/fields`,
    {
      headers: getHeaders(),
      credentials: 'include',
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch fields: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.fields;
}

/**
 * Fetch unique values for a specific field (lazy load tier 3)
 */
export async function fetchFieldValues(
  projectId: number,
  tableName: string,
  fieldName: string,
  limit: number = 100
): Promise<{ values: any[]; has_unique_values: boolean; source: string }> {
  const response = await fetch(
    `${API_BASE_URL}/cohort-projects/${projectId}/tables/${encodeURIComponent(
      tableName
    )}/fields/${encodeURIComponent(fieldName)}/values?limit=${limit}&use_db=true`,
    {
      headers: getHeaders(),
      credentials: 'include',
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch field values: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Fetch all field mappings for a project
 */
export async function fetchFieldMappings(
  projectId: number,
  filters?: { status?: string; source?: string }
): Promise<FieldMapping[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.source) params.append('source', filters.source);
  
  const url = `${API_BASE_URL}/cohort-projects/${projectId}/field-mappings${
    params.toString() ? `?${params.toString()}` : ''
  }`;
  
  const response = await fetch(url, {
    headers: getHeaders(),
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch field mappings: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.field_mappings;
}

/**
 * Create a new field mapping
 */
export async function createFieldMapping(
  projectId: number,
  mapping: {
    table_name: string;
    field_name: string;
    field_type: string;
    concept: string;
    operator: string;
    value: any;
    sql_criterion: string;
    display_text: string;
    source?: 'user' | 'agent' | 'imported';
    status?: 'draft' | 'pending_agent' | 'agent_confirmed' | 'applied';
  }
): Promise<FieldMapping> {
  const response = await fetch(
    `${API_BASE_URL}/cohort-projects/${projectId}/field-mappings`,
    {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(mapping),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to create field mapping: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Update a field mapping (used by agent to confirm mappings)
 */
export async function updateFieldMapping(
  projectId: number,
  mappingId: string,
  updates: Partial<{
    status: 'draft' | 'pending_agent' | 'agent_confirmed' | 'applied';
    sql_criterion: string;
    display_text: string;
    agent_metadata: any;
  }>
): Promise<FieldMapping> {
  const response = await fetch(
    `${API_BASE_URL}/cohort-projects/${projectId}/field-mappings/${mappingId}`,
    {
      method: 'PATCH',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(updates),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to update field mapping: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Delete a field mapping
 */
export async function deleteFieldMapping(
  projectId: number,
  mappingId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/cohort-projects/${projectId}/field-mappings/${mappingId}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to delete field mapping: ${response.statusText}`);
  }
}
