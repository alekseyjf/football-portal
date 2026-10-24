import { queryOptions } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/http';
import { nullIfNotFound } from '@/lib/api/not-found';
import type {
  Club,
  League,
  LeagueDashboard,
  LiveTouchResult,
  MatchDetail,
  MatchesInRange,
} from '@/lib/api/types';

export const footballKeys = {
  leagues: ['football', 'leagues'] as const,
  league: (slug: string) => ['football', 'league', slug] as const,
  club: (slug: string) => ['football', 'club', slug] as const,
  /** Рекомендовано для сайдбару — один round-trip. */
  leagueDashboard: (slug: string) => ['football', 'league-dashboard', slug] as const,
  match: (id: string) => ['football', 'match', id] as const,
  /** `leagueSlug: null` — усі активні турніри */
  matchesInRange: (from: string, to: string, leagueSlug: string | null) =>
    ['football', 'matches-in-range', from, to, leagueSlug] as const,
};

/** Активні турніри для перемикача: змінюються лише з адмінки / синку — кеш довший. */
export function leaguesQueryOptions() {
  return queryOptions({
    queryKey: footballKeys.leagues,
    queryFn: () => apiGet<League[]>('/football/leagues'),
    staleTime: 5 * 60_000,
  });
}

/** Турнір за slug, і вимкнений, — вкладка вибраної ліги стрічки, якої немає серед активних; `null` — такого немає. */
export function leagueQueryOptions(leagueSlug: string) {
  return queryOptions({
    queryKey: footballKeys.league(leagueSlug),
    queryFn: () =>
      nullIfNotFound(
        apiGet<League>(`/football/leagues/${encodeURIComponent(leagueSlug)}`),
      ),
    staleTime: 5 * 60_000,
  });
}

/** Клуб за slug — назва в чипі фільтра стрічки `?club=`; `null` — такого немає. */
export function clubQueryOptions(clubSlug: string) {
  return queryOptions({
    queryKey: footballKeys.club(clubSlug),
    queryFn: () =>
      nullIfNotFound(
        apiGet<Club>(`/football/clubs/${encodeURIComponent(clubSlug)}`),
      ),
    staleTime: 5 * 60_000,
  });
}

export function leagueDashboardQueryOptions(leagueSlug: string) {
  return queryOptions({
    queryKey: footballKeys.leagueDashboard(leagueSlug),
    queryFn: () =>
      apiGet<LeagueDashboard>(
        `/football/leagues/${encodeURIComponent(leagueSlug)}/dashboard`,
      ),
    staleTime: 120_000,
  });
}

/**
 * Матчі за інтервалом (сторінка матчів дня): межі — миттєвості, пораховані в поясі користувача
 * (`zonedDayRange`), тож ключ однаковий на сервері (prefetch) і клієнті.
 */
export function matchesInRangeQueryOptions(
  from: string,
  to: string,
  leagueSlug: string | null,
) {
  const searchParams = new URLSearchParams({ from, to });
  if (leagueSlug) searchParams.set('league', leagueSlug);
  return queryOptions({
    queryKey: footballKeys.matchesInRange(from, to, leagueSlug),
    queryFn: () =>
      apiGet<MatchesInRange>(`/football/matches?${searchParams}`),
    staleTime: 60_000,
  });
}

export function fetchMatchDetail(matchId: string) {
  return apiGet<MatchDetail>(
    `/football/matches/${encodeURIComponent(matchId)}`,
  );
}

export function matchDetailQueryOptions(matchId: string) {
  return queryOptions({
    queryKey: footballKeys.match(matchId),
    queryFn: () => fetchMatchDetail(matchId),
  });
}

export async function requestLiveTouch(matchId: string) {
  return apiPost<LiveTouchResult>('/football/live-touch', { matchId });
}
