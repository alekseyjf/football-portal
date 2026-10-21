import { ADMIN_POSTS_PAGE_LIMIT_DEFAULT } from '@football-portal/validation';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { PaginatedAdminPosts } from '@/lib/api/types';

/**
 * Сторінка списку: усі статуси, крім видалених, нові першими; заголовки всіма мовами — `lang` не потрібен.
 * Ключ починається з `['admin', 'posts']` — мутації скидають усі сторінки разом.
 */
export function adminPostsQueryOptions(page: number) {
  const limit = ADMIN_POSTS_PAGE_LIMIT_DEFAULT;
  return queryOptions({
    queryKey: ['admin', 'posts', { page, limit }] as const,
    queryFn: () =>
      apiGet<PaginatedAdminPosts>(`/posts/admin/all?page=${page}&limit=${limit}`),
    staleTime: 30 * 1000,
    // Під час переходу на іншу сторінку лишається попередня, а не «Loading…»
    placeholderData: keepPreviousData,
  });
}

export function useAdminPosts(page: number) {
  return useQuery(adminPostsQueryOptions(page));
}
