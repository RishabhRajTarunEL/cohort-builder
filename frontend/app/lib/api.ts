/**
 * API utility for making requests to Django backend
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
 * Make an authenticated API request to Django backend
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const csrfToken = getCookie('csrftoken');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...(options.headers || {}),
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch demographics analytics
 */
export async function fetchDemographics(projectId: string, filters: any[]) {
  return apiRequest(`/cohort-projects/${projectId}/analytics/demographics`, {
    method: 'POST',
    body: JSON.stringify({ filters }),
  });
}

/**
 * Fetch diagnoses analytics
 */
export async function fetchDiagnoses(projectId: string, filters: any[]) {
  return apiRequest(`/cohort-projects/${projectId}/analytics/diagnoses`, {
    method: 'POST',
    body: JSON.stringify({ filters }),
  });
}

/**
 * Fetch cohort project details
 */
export async function fetchCohortProject(projectId: string) {
  return apiRequest(`/cohort-projects/${projectId}`, {
    method: 'GET',
  });
}

/**
 * Chat API Types
 */
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  timestamp: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  message_count: number;
  last_message?: {
    role: string;
    content: string;
    timestamp: string;
  };
}

/**
 * Send a message to the chat agent
 */
export async function sendChatMessage(
  projectId: number,
  message: string,
  sessionId?: string,
  conversationHistory?: any[]
) {
  return apiRequest('/chat/', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      message,
      session_id: sessionId,
      conversation_history: conversationHistory || [],
    }),
  });
}

/**
 * Get all chat sessions for a project
 */
export async function fetchChatHistory(projectId: number) {
  return apiRequest<{
    project_id: number;
    sessions: ChatSession[];
    total_sessions: number;
    status: string;
  }>(`/chat/history/?project_id=${projectId}`, {
    method: 'GET',
  });
}

/**
 * Get messages for a specific chat session
 */
export async function fetchChatSession(sessionId: string, projectId: number) {
  return apiRequest<{
    session_id: string;
    project_id: number;
    title: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    messages: ChatMessage[];
    message_count: number;
    status: string;
  }>(`/chat/session/${sessionId}/?project_id=${projectId}`, {
    method: 'GET',
  });
}

/**
 * HTTP method helpers
 */
async function get<T = any>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

async function post<T = any>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

async function put<T = any>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

async function patch<T = any>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

async function del<T = any>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}

/**
 * API object for both default and named exports
 */
export const api = {
  apiRequest,
  get,
  post,
  put,
  patch,
  delete: del,
  fetchDemographics,
  fetchDiagnoses,
  fetchCohortProject,
  // Chat APIs
  sendChatMessage,
  fetchChatHistory,
  fetchChatSession,
};

export default api;
