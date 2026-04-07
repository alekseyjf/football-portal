import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Дані вважаються свіжими 60 секунд — не рефетчить зайво
        staleTime: 60 * 1000,
        // При помилці не ретраїть автоматично
        retry: false,
      },
    },
  });
}