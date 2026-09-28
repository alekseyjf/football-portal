import type {
  FootballLeagueMeta,
  FootballMatchLeague,
  FootballMatchListItem,
} from '@/lib/api/types';
import { LEAGUE_QUERY_PARAM } from './league-param';

/** День сторінки матчів у query: `/ua/matches?date=2026-10-10`; без нього — сьогодні. */
export const MATCHES_DATE_QUERY_PARAM = 'date';

/** Посилання на сторінку матчів: день (`null` — сьогодні) і ліга (`null` — усі активні). */
export function matchesPageHref(dayKey: string | null, leagueSlug: string | null) {
  const query: Record<string, string> = {};
  if (dayKey) query[MATCHES_DATE_QUERY_PARAM] = dayKey;
  if (leagueSlug) query[LEAGUE_QUERY_PARAM] = leagueSlug;
  return { pathname: '/matches', query };
}

export type LeagueMatchGroup = {
  league: FootballMatchLeague;
  matches: FootballMatchListItem[];
};

/**
 * Матчі дня → групи за турніром. Порядок груп — як у перемикачі ліг (`GET /football/leagues`,
 * за `sortOrder`); турнір поза списком (вимкнений, відкритий за slug) — наприкінці, за назвою.
 * Матчі в групі — у порядку API (за часом початку).
 */
export function groupMatchesByLeague(
  matches: FootballMatchListItem[],
  orderedLeagues: FootballLeagueMeta[],
): LeagueMatchGroup[] {
  const groupsBySlug = new Map<string, LeagueMatchGroup>();
  for (const match of matches) {
    let group = groupsBySlug.get(match.league.slug);
    if (!group) {
      group = { league: match.league, matches: [] };
      groupsBySlug.set(match.league.slug, group);
    }
    group.matches.push(match);
  }

  const rankBySlug = new Map(
    orderedLeagues.map((league, index) => [league.slug, index]),
  );
  const rankOf = (group: LeagueMatchGroup) =>
    rankBySlug.get(group.league.slug) ?? Number.MAX_SAFE_INTEGER;
  return [...groupsBySlug.values()].sort(
    (leftGroup, rightGroup) =>
      rankOf(leftGroup) - rankOf(rightGroup) ||
      leftGroup.league.name.localeCompare(rightGroup.league.name),
  );
}

/** Тур, спільний для всіх матчів групи (у лізі за день — зазвичай так), інакше `null`. */
export function commonRoundOf(
  matches: FootballMatchListItem[],
): { stage: string; matchday: number | null } | null {
  const [firstMatch] = matches;
  if (!firstMatch) return null;
  const isSameRound = matches.every(
    (match) =>
      match.stage === firstMatch.stage &&
      match.matchday === firstMatch.matchday,
  );
  return isSameRound
    ? { stage: firstMatch.stage, matchday: firstMatch.matchday }
    : null;
}
