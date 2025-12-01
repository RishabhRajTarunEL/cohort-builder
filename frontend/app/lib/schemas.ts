/**
 * Type definitions for authentication and user data
 */

export interface User {
  id: number | string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_approved: boolean;
  has_completed_profile: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  polly_api_key?: string;
}
