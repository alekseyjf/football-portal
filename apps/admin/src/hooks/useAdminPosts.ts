import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminPostRow } from '@/lib/api/types';

/** Усі пости (крім видалених) з заголовками всіма мовами — `lang` не потрібен. */
export function adminPostsQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'posts'] as const,
    queryFn: () => apiGet<AdminPostRow[]>('/posts/admin/all'),
    staleTime: 30 * 1000,
  });
}

export function useAdminPosts() {
  return useQuery(adminPostsQueryOptions());
}
