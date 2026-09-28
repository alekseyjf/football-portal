import { queryOptions } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/http';
import type {
  FootballLeagueMeta,
  LeagueDashboardResponse,
  LeagueFixturesResponse,
  MatchDetail,
  MatchesInRangeResponse,
  StandingTable,
} from '@/lib/api/types';

export const footballKeys = {
  leagues: ['football', 'leagues'] as const,
  /** Рекомендовано для сайдбару — один round-trip. */
  leagueDashboard: (slug: string) => ['football', 'league-dashboard', slug] as const,
  standings: (slug: string) => ['football', 'standings', slug] as const,
  fixtures: (slug: string) => ['football', 'fixtures', slug] as const,
  match: (id: string) => ['football', 'match', id] as const,
  /** `leagueSlug: null` — усі активні турніри */
  matchesInRange: (from: string, to: string, leagueSlug: string | null) =>
    ['football', 'matches-in-range', from, to, leagueSlug] as const,
};

/** Активні турніри для перемикача: змінюються лише з адмінки / синку — кеш довший. */
export function leaguesQueryOptions() {
  return queryOptions({
    queryKey: footballKeys.leagues,
    queryFn: () => apiGet<FootballLeagueMeta[]>('/football/leagues'),
    staleTime: 5 * 60_000,
  });
}

export function leagueDashboardQueryOptions(leagueSlug: string) {
  return queryOptions({
    queryKey: footballKeys.leagueDashboard(leagueSlug),
    queryFn: () =>
      apiGet<LeagueDashboardResponse>(
        `/football/leagues/${encodeURIComponent(leagueSlug)}/dashboard`,
      ),
    staleTime: 120_000,
  });
}

export function standingsQueryOptions(leagueSlug: string) {
  return queryOptions({
    queryKey: footballKeys.standings(leagueSlug),
    queryFn: () =>
      apiGet<StandingTable[]>(
        `/football/leagues/${encodeURIComponent(leagueSlug)}/standings`,
      ),
  });
}

export function fixturesQueryOptions(leagueSlug: string) {
  return queryOptions({
    queryKey: footballKeys.fixtures(leagueSlug),
    queryFn: () =>
      apiGet<LeagueFixturesResponse>(
        `/football/leagues/${encodeURIComponent(leagueSlug)}/fixtures`,
      ),
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
      apiGet<MatchesInRangeResponse>(`/football/matches?${searchParams}`),
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
  return apiPost<{
    accepted: boolean;
    skipped?: 'not_found' | 'not_live' | 'throttled' | 'no_api_key';
  }>('/football/live-touch', { matchId });
}
