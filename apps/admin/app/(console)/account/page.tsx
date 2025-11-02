'use client';

import { useMemo } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@icupa/ui';
import { useAdminSession } from '../session-context';
import { getSupabaseBrowserClient } from '../../../lib/supabase-browser';

export default function AccountPage() {
  const session = useAdminSession();

  const roleSummary = useMemo(() => {
    const perTenant = new Map<string | null, string[]>();
    session.roles.forEach((role) => {
      const key = role.tenantId ?? 'global';
      if (!perTenant.has(key)) {
        perTenant.set(key, []);
      }
      perTenant.get(key)!.push(role.role);
    });
    return Array.from(perTenant.entries()).map(([tenantId, roles]) => ({ tenantId, roles }));
  }, [session.roles]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Account</h1>
        <p className="text-sm text-white/70">Manage your session, roles, and organization access.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-surface border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Session</CardTitle>
            <CardDescription className="text-white/70">Current admin identity issued by Supabase Auth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/80">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">Email</p>
              <p className="font-medium text-white">{session.user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">User ID</p>
              <p className="text-white/70">{session.user.id}</p>
            </div>
            <Button variant="outline" className="glass-surface border-white/20 text-white" onClick={handleSignOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-surface border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Roles</CardTitle>
            <CardDescription className="text-white/70">Tenant access inherited from Supabase user_roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/70">
            {roleSummary.length === 0 && <p>No tenant roles assigned.</p>}
            {roleSummary.map((entry) => (
              <div key={entry.tenantId ?? 'global'} className="rounded-lg border border-white/15 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">
                  {entry.tenantId ? `Tenant ${entry.tenantId}` : 'Global'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.roles.map((role) => (
                    <Badge key={role} variant="outline" className="border-white/20 text-xs text-white">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
