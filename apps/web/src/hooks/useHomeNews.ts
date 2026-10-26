import { queryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type { ApiContentLanguage, HomePosts } from '@/lib/api/types';

/** Новин під головною (D55): від 1024 px три — поруч із нею, ще три — під ними. Стільки ж віддає `GET /posts/home`. */
export const HOME_LATEST_NEWS_COUNT = 6;

/**
 * Головна новина (закріплена редактором, інакше найсвіжіша — D56) і шість найсвіжіших без неї — одним запитом; ключ
 * спільний для сервера (`fetchQuery`) і клієнта.
 */
export function homeNewsQueryOptions(lang: ApiContentLanguage) {
  return queryOptions({
    queryKey: ['posts', 'home', lang] as const,
    queryFn: () =>
      apiGet<HomePosts>(`/posts/home?lang=${encodeURIComponent(lang)}`),
    staleTime: 60_000,
  });
}
