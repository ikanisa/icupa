'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { TableSessionProvider } from '../lib/table-session';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <TableSessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TableSessionProvider>
  );
}
