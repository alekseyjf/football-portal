import { queryOptions } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/http';
import type {
  FootballLeagueMeta,
  LeagueDashboardResponse,
  LeagueFixturesResponse,
  MatchDetail,
  StandingRow,
} from '@/lib/api/types';

export const footballKeys = {
  leagues: ['football', 'leagues'] as const,
  /** Рекомендовано для сайдбару — один round-trip. */
  leagueDashboard: (slug: string) => ['football', 'league-dashboard', slug] as const,
  standings: (slug: string) => ['football', 'standings', slug] as const,
  fixtures: (slug: string) => ['football', 'fixtures', slug] as const,
  match: (id: string) => ['football', 'match', id] as const,
};

export function leaguesQueryOptions() {
  return queryOptions({
    queryKey: footballKeys.leagues,
    queryFn: () => apiGet<FootballLeagueMeta[]>('/football/leagues'),
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
      apiGet<StandingRow[]>(
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

export function matchDetailQueryOptions(matchId: string) {
  return queryOptions({
    queryKey: footballKeys.match(matchId),
    queryFn: () =>
      apiGet<MatchDetail>(`/football/matches/${encodeURIComponent(matchId)}`),
  });
}

export async function requestLiveTouch(matchId: string) {
  return apiPost<{
    accepted: boolean;
    skipped?: 'not_found' | 'not_live' | 'throttled' | 'no_api_key';
  }>('/football/live-touch', { matchId });
}
