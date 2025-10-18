'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { VendorAuthProvider } from '../lib/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <VendorAuthProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </VendorAuthProvider>
  );
}
