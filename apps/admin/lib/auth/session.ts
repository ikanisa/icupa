import { redirect } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@icupa/db';
import type { TypedSupabaseClient } from '@icupa/db';
import { getSupabaseServerClient } from '../supabase-server';

export type AdminRole = {
  tenantId: string | null;
  role: string;
};

export interface AdminSession {
  user: User;
  roles: AdminRole[];
  session: Session;
}

async function fetchRoles(client: TypedSupabaseClient, userId: string): Promise<AdminRole[]> {
  const { data, error } = await client
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    tenantId: row.tenant_id ?? null,
    role: row.role as string,
  }));
}

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const serviceClient = createServerSupabaseClient();
  const roles = await fetchRoles(serviceClient, session.user.id);
  const hasAdminRole = roles.some((role) => role.role === 'admin');

  if (!hasAdminRole) {
    redirect('/login?reason=forbidden');
  }

  return { user: session.user, roles, session };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const serviceClient = createServerSupabaseClient();
  const roles = await fetchRoles(serviceClient, session.user.id);
  const hasAdminRole = roles.some((role) => role.role === 'admin');

  if (!hasAdminRole) {
    return null;
  }

  return { user: session.user, roles, session };
}
