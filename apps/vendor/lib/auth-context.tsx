'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createBrowserSupabaseClient } from '@icupa/db';
import type { TypedSupabaseClient } from '@icupa/db';
import type { VerifyOtpResponse } from './api';

export type VendorUser = {
  phone: string;
  id?: string;
};

type VendorAuthContextValue = {
  supabase: TypedSupabaseClient;
  user: VendorUser | null;
  isAuthenticated: boolean;
  login: (phone: string, payload: VerifyOtpResponse) => Promise<void>;
  logout: () => Promise<void>;
};

const VendorAuthContext = createContext<VendorAuthContextValue | undefined>(undefined);

export const VendorAuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<VendorUser | null>(null);

  const login = useCallback(
    async (phone: string, payload: VerifyOtpResponse) => {
      if (payload.session) {
        await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
      }
      setUser({
        phone,
        id: payload.user?.id,
      });
    },
    [supabase],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const value = useMemo(
    () => ({
      supabase,
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [login, logout, supabase, user],
  );

  return <VendorAuthContext.Provider value={value}>{children}</VendorAuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useVendorAuth = () => {
  const context = useContext(VendorAuthContext);
  if (!context) {
    throw new Error('useVendorAuth must be used within VendorAuthProvider');
  }
  return context;
};
