import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminPostDetail } from '@/lib/api/types';

/**
 * Новина для форми редагування — будь-якого статусу, переклади з текстом (`GET /posts/admin/{id}`, D47).
 * Ключ — під `['admin', 'posts']`: мутації новин скидають і її, і список.
 */
export function adminPostQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['admin', 'posts', 'detail', id] as const,
    queryFn: () => apiGet<AdminPostDetail>(`/posts/admin/${encodeURIComponent(id)}`),
  });
}

export function useAdminPost(id: string) {
  return useQuery(adminPostQueryOptions(id));
}

/** Новина з API, а не з кешу, — щойно збережена. Запит, що вже йде (після інвалідації), не дублюється. */
export function fetchFreshAdminPost(queryClient: QueryClient, id: string): Promise<AdminPostDetail> {
  return queryClient.fetchQuery({ ...adminPostQueryOptions(id), staleTime: 0 });
}
