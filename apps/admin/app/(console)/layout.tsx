import type { ReactNode } from 'react';
import { ConsoleShell } from './shell';
import { requireAdmin } from '../../lib/auth/session';
import { AdminSessionProvider } from './session-context';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <AdminSessionProvider value={admin}>
      <ConsoleShell>{children}</ConsoleShell>
    </AdminSessionProvider>
  );
}
