import { infiniteQueryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { ApiContentLanguage, PaginatedPosts } from '@/lib/api/types';
import { newsFeedApiPath, type NewsFeedFilters } from './news-feed-filters';

/** Новин на сторінці стрічки: сітка по 3 картки — 4 ряди (M1.6.1). */
export const NEWS_FEED_PAGE_SIZE = 12;

/**
 * Стрічка від сторінки `startPage` (адреса `?page=N` — її рендерить сервер, D38) і далі — «Завантажити ще». Ключ — з
 * фільтрами й першою сторінкою: сервер (prefetch) і клієнт (`useNewsFeed`) беруть той самий.
 */
export function newsFeedQueryOptions(
  filters: NewsFeedFilters,
  lang: ApiContentLanguage,
  startPage: number,
) {
  return infiniteQueryOptions({
    queryKey: ['posts', 'feed', lang, filters, startPage] as const,
    queryFn: ({ pageParam }) =>
      apiGet<PaginatedPosts>(
        newsFeedApiPath(filters, {
          page: pageParam,
          limit: NEWS_FEED_PAGE_SIZE,
          lang,
        }),
      ),
    initialPageParam: startPage,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 60_000,
  });
}
