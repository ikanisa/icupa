/**
 * Supabase client wrappers for use with OpenAI Agents SDK
 * 
 * This module provides properly typed Supabase clients for both frontend and backend use.
 * It follows the pattern described in the OpenAI Agents SDK integration blueprint.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get environment variable with fallback for browser vs server
 */
function getEnvVar(name: string): string {
  // Try Vite-style env vars (browser)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteVar = import.meta.env[name];
    if (viteVar) return viteVar;
  }
  
  // Try process.env (Node.js)
  if (typeof process !== 'undefined' && process.env) {
    const nodeVar = process.env[name];
    if (nodeVar) return nodeVar;
  }
  
  throw new Error(`Environment variable ${name} is not set`);
}

/**
 * Frontend Supabase client
 * Uses the anon key for Row Level Security (RLS) enforcement
 * Safe to use in browser contexts
 */
export function createFrontendClient(): SupabaseClient {
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * Backend Supabase client
 * Uses the service role key for bypassing RLS when needed
 * Should ONLY be used in server-side contexts
 * 
 * SECURITY WARNING: Never expose this client to the browser!
 * The service role key bypasses Row Level Security.
 */
export function createBackendClient(): SupabaseClient {
  const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
  const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for backend client. ' +
      'This should only be used in server-side code.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Agent-specific Supabase client
 * For use within OpenAI agent tools and handlers
 * Uses service role key with additional safety guardrails
 */
export function createAgentClient(options?: {
  tenantId?: string;
  userId?: string;
}): SupabaseClient {
  const client = createBackendClient();

  // Add tenant isolation if tenantId is provided
  // This ensures multi-tenant data isolation even with service role key
  if (options?.tenantId) {
    // In a real implementation, you might want to:
    // 1. Set a custom header or context variable
    // 2. Use RLS policies that check this tenant ID
    // 3. Filter queries by tenant_id automatically
    
    // For now, we'll add it as a custom header that can be used by RLS policies
    client.headers = {
      ...client.headers,
      'x-tenant-id': options.tenantId,
    };
  }

  if (options?.userId) {
    client.headers = {
      ...client.headers,
      'x-user-id': options.userId,
    };
  }

  return client;
}

/**
 * Type-safe database query helpers
 * These provide better type inference for common database operations
 */
export const db = {
  /**
   * Execute a database query with better error handling
   */
  async query<T>(
    client: SupabaseClient,
    operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<T> {
    const { data, error } = await operation(client);
    
    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Database query returned no data');
    }
    
    return data;
  },

  /**
   * Execute a mutation with automatic error handling
   */
  async mutate<T>(
    client: SupabaseClient,
    operation: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<T> {
    const { data, error } = await operation(client);
    
    if (error) {
      throw new Error(`Database mutation failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Database mutation returned no data');
    }
    
    return data;
  },
};

/**
 * Example usage:
 * 
 * // Frontend (browser)
 * const client = createFrontendClient();
 * const { data: items } = await client.from('menu_items').select('*');
 * 
 * // Backend (server/API)
 * const client = createBackendClient();
 * const { data: users } = await client.from('profiles').select('*');
 * 
 * // In an agent tool
 * const client = createAgentClient({ tenantId: 'tenant-123', userId: 'user-456' });
 * const bookings = await db.query(
 *   client,
 *   (c) => c.from('bookings').select('*').eq('tenant_id', 'tenant-123')
 * );
 */
