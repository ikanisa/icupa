'use client';

import { createContext, useContext } from 'react';
import type { AdminSession } from '../../lib/auth/session';

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ value, children }: { value: AdminSession; children: React.ReactNode }) {
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error('useAdminSession must be used within AdminSessionProvider');
  }
  return context;
}
