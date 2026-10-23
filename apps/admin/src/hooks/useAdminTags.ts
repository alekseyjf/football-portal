import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { AdminTag } from '@/lib/api/types';

/**
 * Усі теги з назвами всіма мовами й кількістю новин (`GET /tags/admin/all`, D45) — сторінка «Теги» і вибір тегів у
 * формі новини. Без сторінок: тегів — сотні, фільтр — на клієнті.
 */
export function adminTagsQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'tags'] as const,
    queryFn: () => apiGet<AdminTag[]>('/tags/admin/all'),
    staleTime: 30 * 1000,
  });
}

export function useAdminTags() {
  return useQuery(adminTagsQueryOptions());
}

/**
 * Змінити список тегів у кеші без запиту: `POST` / `PUT /tags` віддають готовий рядок списку (D45). Списку ще немає —
 * лишаємо як є: його прочитає перший, кому він знадобиться.
 */
export function updateCachedAdminTags(queryClient: QueryClient, update: (tags: AdminTag[]) => AdminTag[]): void {
  queryClient.setQueryData(adminTagsQueryOptions().queryKey, (tags) => (tags ? update(tags) : tags));
}
