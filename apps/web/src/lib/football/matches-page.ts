import type { League, MatchLeague, MatchListItem } from '@/lib/api/types';
import { isDayKey } from '@/lib/i18n/zoned-date';
import {
  isLeagueSlug,
  LEAGUE_QUERY_PARAM,
  leagueSlugFromParam,
} from './league-param';

/** День сторінки матчів у query: `/uk/matches?date=2026-10-10`; без нього — сьогодні. */
export const MATCHES_DATE_QUERY_PARAM = 'date';

/** Посилання на сторінку матчів: день (`null` — сьогодні) і ліга (`null` — усі активні). */
export function matchesPageHref(
  dayKey: string | null,
  leagueSlug: string | null,
) {
  const query: Record<string, string> = {};
  if (dayKey) query[MATCHES_DATE_QUERY_PARAM] = dayKey;
  if (leagueSlug) query[LEAGUE_QUERY_PARAM] = leagueSlug;
  return { pathname: '/matches', query };
}

type SearchParamValue = string | string[] | undefined;
/** Параметри адреси, як їх віддає Next (`searchParams`); чужі (`utm_*`) — теж тут. */
export type MatchesPageSearchParams = Partial<Record<string, SearchParamValue>>;

/** День і ліга з адреси `/matches`; немає чи невалідні — `null` (сьогодні / усі турніри), без 404. */
export function parseMatchesPageParams(searchParams: MatchesPageSearchParams): {
  dayKey: string | null;
  leagueSlug: string | null;
} {
  // Повтор параметра — перше значення, як і для ліги (`leagueSlugFromParam`)
  const dateParam = (
    Array.isArray(searchParams.date) ? searchParams.date[0] : searchParams.date
  )?.trim();
  const leagueParam = leagueSlugFromParam(searchParams.league);
  return {
    dayKey: dateParam && isDayKey(dateParam) ? dateParam : null,
    leagueSlug: leagueParam && isLeagueSlug(leagueParam) ? leagueParam : null,
  };
}

/**
 * `/matches` для пошуку (M1.8.1): без параметрів — в індексі; з днем чи лігою — `noindex, follow` і canonical на себе
 * (лише розібрані параметри, без `utm_*`) — інакше кожен день кожної ліги став би окремою сторінкою майже без тексту.
 */
export function matchesSearchPage(searchParams: MatchesPageSearchParams) {
  const { dayKey, leagueSlug } = parseMatchesPageParams(searchParams);
  return {
    href: matchesPageHref(dayKey, leagueSlug),
    isIndexable: !dayKey && !leagueSlug,
  };
}

export type LeagueMatchGroup = {
  league: MatchLeague;
  matches: MatchListItem[];
};

/**
 * Порядок турнірів матчів — як у перемикачі ліг (`GET /football/leagues`, за `sortOrder`); турнір поза списком
 * (вимкнений, відкритий за slug) — наприкінці, за назвою. Той самий — на `/matches` і в стрічці матчів головної.
 */
export function compareLeaguesByOrder(orderedLeagues: League[]) {
  const rankBySlug = new Map(
    orderedLeagues.map((league, index) => [league.slug, index]),
  );
  const rankOf = (league: MatchLeague) =>
    rankBySlug.get(league.slug) ?? Number.MAX_SAFE_INTEGER;
  return (leftLeague: MatchLeague, rightLeague: MatchLeague): number =>
    rankOf(leftLeague) - rankOf(rightLeague) ||
    leftLeague.name.localeCompare(rightLeague.name) ||
    leftLeague.slug.localeCompare(rightLeague.slug);
}

/**
 * Матчі дня → групи за турніром (`compareLeaguesByOrder`). Матчі в групі — у порядку API (за часом початку).
 */
export function groupMatchesByLeague(
  matches: MatchListItem[],
  orderedLeagues: League[],
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

  const compareLeagues = compareLeaguesByOrder(orderedLeagues);
  return [...groupsBySlug.values()].sort((leftGroup, rightGroup) =>
    compareLeagues(leftGroup.league, rightGroup.league),
  );
}

/** Тур, спільний для всіх матчів групи (у лізі за день — зазвичай так), інакше `null`. */
export function commonRoundOf(
  matches: MatchListItem[],
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
