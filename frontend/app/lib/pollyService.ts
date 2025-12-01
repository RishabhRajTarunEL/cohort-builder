/**
 * Polly Atlas API Service
 * Provides functions to interact with Polly Atlas APIs via backend proxy
 */

import { api } from './api';

// Polly API uses JSON API spec structure
export interface PollyUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface PollyPermission {
  type: string;
  id: number;
  attributes: {
    principal_type: string;
    principal_id: string;
    access: string;
    user: PollyUser;
    user_id: string;
    role: string;
  };
}

export interface PollyAtlasAttributes {
  name: string;
  created_on: string;
  description: string;
  size: number;
  num_tables: number;
  created_by: PollyUser;
}

export interface PollyAtlasData {
  id: string;
  type: string;
  attributes: PollyAtlasAttributes;
  relationships: {
    permissions: {
      data: PollyPermission[];
    };
  };
}

export interface PollyAtlasListResponse {
  data: PollyAtlasData[];
}

// Normalized Atlas interface for easier use in components
export interface Atlas {
  atlas_id: string;
  atlas_name: string;
  description: string;
  created_at: string;
  size: number;
  num_tables: number;
  created_by: PollyUser;
  permissions: PollyPermission[];
}

/**
 * Transform Polly API response to normalized Atlas objects
 */
function transformPollyAtlases(response: PollyAtlasListResponse): Atlas[] {
  return response.data.map((item) => ({
    atlas_id: item.id,
    atlas_name: item.attributes.name,
    description: item.attributes.description,
    created_at: item.attributes.created_on,
    size: item.attributes.size,
    num_tables: item.attributes.num_tables,
    created_by: item.attributes.created_by,
    permissions: item.relationships.permissions.data,
  }));
}

/**
 * Fetch all atlases from Polly using the authenticated user's API key
 */
export async function getAllAtlases(): Promise<Atlas[]> {
  try {
    const response: PollyAtlasListResponse = await api.get('/polly/atlases');
    return transformPollyAtlases(response);
  } catch (error: any) {
    console.error('Failed to fetch atlases from Polly:', error);
    throw new Error(error.message || 'Failed to fetch atlases from Polly');
  }
}

/**
 * Start processing an atlas to create SQLite database
 */
export async function processAtlas(atlasId: string): Promise<{ task_id: string; status: string }> {
  try {
    const response = await api.post(`/polly/atlases/${atlasId}/process`, {});
    return response;
  } catch (error: any) {
    console.error('Failed to start atlas processing:', error);
    throw new Error(error.message || 'Failed to start atlas processing');
  }
}

/**
 * Get the status of an atlas processing task
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  try {
    const response = await api.get(`/polly/tasks/${taskId}/status`);
    return response;
  } catch (error: any) {
    console.error('Failed to get task status:', error);
    throw new Error(error.message || 'Failed to get task status');
  }
}

/**
 * Get the current task status for an atlas (if any task is running)
 */
export async function getAtlasTaskStatus(atlasId: string): Promise<any> {
  try {
    const response = await api.get(`/polly/atlases/${atlasId}/task-status`);
    return response;
  } catch (error: any) {
    console.error('Failed to get atlas task status:', error);
    throw new Error(error.message || 'Failed to get atlas task status');
  }
}
