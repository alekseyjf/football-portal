import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { League } from '@/lib/api/types';
import {
  newsFeedHref,
  withoutClub,
  withoutTag,
  type NewsFeedFilters,
} from '@/lib/news/news-feed-filters';
import { newsFeedLeagueTabs } from '@/lib/news/news-feed-leagues';
import { useApiContentLang } from './useApiContentLang';
import {
  clubQueryOptions,
  leagueQueryOptions,
  leaguesQueryOptions,
} from './useFootball';
import { tagQueryOptions } from './useTags';

/**
 * Вкладки ліг стрічки: турніри «у грі» + вибраний (`newsFeedLeagueTabs`). Вибраного немає серед увімкнених — його
 * назву дає `GET /football/leagues/{slug}`.
 */
export function useNewsFeedLeagueTabs(selectedSlug: string | null): League[] {
  const leaguesQuery = useQuery(leaguesQueryOptions());
  const activeLeagues = leaguesQuery.data ?? [];
  const needsSelectedLeague =
    selectedSlug !== null &&
    leaguesQuery.isSuccess &&
    !activeLeagues.some((league) => league.slug === selectedSlug);
  const selectedLeagueQuery = useQuery({
    ...leagueQueryOptions(selectedSlug ?? ''),
    enabled: needsSelectedLeague,
  });
  return newsFeedLeagueTabs(
    activeLeagues,
    selectedSlug,
    needsSelectedLeague ? (selectedLeagueQuery.data ?? null) : null,
  );
}

export type NewsFeedFilterChip = {
  key: string;
  /** «Тег: Трансфери» — назва мовою сторінки; тегу чи клубу вже немає — slug */
  label: string;
  /** Стрічка без цього значення, решта фільтрів — ті самі */
  href: string;
};

/** Чипи вибраних тегів і клубів з «×» — назви з API, одним запитом на значення (кеш спільний з сервером). */
export function useNewsFeedFilterChips(
  filters: NewsFeedFilters,
): NewsFeedFilterChip[] {
  const t = useTranslations('newsFeed');
  const lang = useApiContentLang();
  const tagQueries = useQueries({
    queries: filters.tags.map((tagSlug) => tagQueryOptions(tagSlug, lang)),
  });
  const clubQueries = useQueries({
    queries: filters.clubs.map((clubSlug) => clubQueryOptions(clubSlug)),
  });
  return [
    ...filters.tags.map((tagSlug, index) => ({
      key: `tag:${tagSlug}`,
      label: t('tagChip', { name: tagQueries[index]?.data?.name ?? tagSlug }),
      href: newsFeedHref(withoutTag(filters, tagSlug)),
    })),
    ...filters.clubs.map((clubSlug, index) => ({
      key: `club:${clubSlug}`,
      label: t('clubChip', {
        name: clubQueries[index]?.data?.name ?? clubSlug,
      }),
      href: newsFeedHref(withoutClub(filters, clubSlug)),
    })),
  ];
}
