import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";

const FUNCTION_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reconciliation`;
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_SERVICE_TOKEN ?? "";

export interface ReconciliationRun {
  id: string;
  coverage_start: string;
  coverage_end: string;
  total_captured_cents: number;
  total_failed: number;
  pending_payments: number;
  status: string;
  notes?: string | null;
  completed_at?: string | null;
}

async function fetchLatestRuns(): Promise<ReconciliationRun[]> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ADMIN_TOKEN) headers['x-icupa-admin-token'] = ADMIN_TOKEN;

  const response = await fetch(`${FUNCTION_BASE_URL}/latest`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load reconciliation runs');
  }

  const payload = await response.json();
  return payload.runs as ReconciliationRun[];
}

export function useReconciliationRuns() {
  return useQuery({
    queryKey: ['supabase', 'admin', 'reconciliation-runs'],
    queryFn: fetchLatestRuns,
    ...withSupabaseCaching({ entity: 'reconciliation', staleTime: 60_000 }),
  });
}

interface RunReconciliationInput {
  start?: string;
  end?: string;
}

async function triggerReconciliation(input: RunReconciliationInput) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ADMIN_TOKEN) headers['x-icupa-admin-token'] = ADMIN_TOKEN;

  const response = await fetch(`${FUNCTION_BASE_URL}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? 'Failed to run reconciliation');
  }

  return response.json();
}

export function useRunReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerReconciliation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['supabase', 'admin', 'reconciliation-runs'] }),
  });
}
