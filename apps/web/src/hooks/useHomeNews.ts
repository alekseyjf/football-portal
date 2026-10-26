import { queryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import type {
  ApiContentLanguage,
  PaginatedPosts,
  PostSummary,
} from '@/lib/api/types';

/** Новин під головною (D55): від 1024 px три — поруч із нею, ще три — під ними. */
export const HOME_LATEST_NEWS_COUNT = 6;

export type HomeNews = {
  /** Головна новина — поки найсвіжіша (закріплення редактором — M1.6.4); `null` — новин немає */
  lead: PostSummary | null;
  latest: PostSummary[];
};

function toHomeNews(page: PaginatedPosts): HomeNews {
  const [lead = null, ...latest] = page.data;
  return { lead, latest };
}

/**
 * Головна новина й шість останніх — одним запитом; ключ спільний для сервера (`fetchQuery`) і клієнта. `select` діє лише
 * в `useQuery`: у кеші лежить сторінка API, як її віддав сервер.
 */
export function homeNewsQueryOptions(lang: ApiContentLanguage) {
  return queryOptions({
    queryKey: ['posts', 'home', lang] as const,
    queryFn: () =>
      apiGet<PaginatedPosts>(
        `/posts?page=1&limit=${HOME_LATEST_NEWS_COUNT + 1}&lang=${encodeURIComponent(lang)}`,
      ),
    select: toHomeNews,
    staleTime: 60_000,
  });
}
