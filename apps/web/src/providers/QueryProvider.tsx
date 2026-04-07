'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { makeQueryClient } from '@/lib/query/queryClient';

export function QueryProviders({ children }: { children: React.ReactNode }) {
  // useState щоб QueryClient не створювався заново при кожному рендері
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools видно тільки в dev режимі — кнопка внизу екрану */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}