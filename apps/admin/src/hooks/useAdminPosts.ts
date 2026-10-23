import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { PaginatedAdminPosts } from '@/lib/api/types';
import { adminPostsApiPath, type PostListParams } from '@/lib/postListParams';

function isSameFilter(left: PostListParams, right: PostListParams): boolean {
  return left.status === right.status && left.search === right.search;
}

/**
 * Сторінка списку: статус «як бачить редактор», пошук у заголовках будь-якою мовою, нові першими; заголовки всіма
 * мовами — `lang` не потрібен. Ключ починається з `['admin', 'posts']` — мутації скидають усі сторінки разом.
 */
export function adminPostsQueryOptions(params: PostListParams) {
  return queryOptions({
    queryKey: ['admin', 'posts', 'list', params] as const,
    queryFn: () => apiGet<PaginatedAdminPosts>(adminPostsApiPath(params)),
    staleTime: 30 * 1000,
    // Інша сторінка того самого фільтра — поки вантажиться, видно попередню. Інший фільтр чи пошук — «Loading»:
    // старі рядки під новим фільтром виглядали б його результатом
    placeholderData: (previousPage, previousQuery) =>
      previousQuery && isSameFilter(previousQuery.queryKey[3], params) ? previousPage : undefined,
  });
}

export function useAdminPosts(params: PostListParams) {
  return useQuery(adminPostsQueryOptions(params));
}
