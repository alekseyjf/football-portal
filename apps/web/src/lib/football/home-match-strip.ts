import {
  IN_PLAY_MATCH_STATUSES,
  type League,
  type MatchListItem,
  type MatchStatus,
} from '@/lib/api/types';
import { dayKeyInTimeZone, zonedDayRange } from '@/lib/i18n/zoned-date';
import { compareLeaguesByOrder } from './matches-page';

/** Скільки матчів стрічка головної кладе в розмітку (D55): у суботу їх буває 80, решта — на `/matches`. */
export const HOME_STRIP_MAX_MATCHES = 40;

/** День стрічки в поясі читача: ключ (`?date=` сторінки матчів) і межі для `GET /football/matches`. */
export type MatchStripDay = { dayKey: string; from: string; to: string };

/**
 * День, на який припадає миттєвість у поясі читача: сьогодні — `now`, «Найближчі матчі» — час початку найближчого
 * матчу. Та сама мить біля півночі — різні дні й межі в Києві й Нью-Йорку (🧭 п. 3).
 */
export function matchStripDayOf(
  instant: Date,
  timeZone: string,
): MatchStripDay {
  const dayKey = dayKeyInTimeZone(instant, timeZone);
  return { dayKey, ...zonedDayRange(dayKey, timeZone) };
}

/** Статус у межах турніру: іде → попереду → завершився → перенесений, перерваний чи скасований. */
function statusRank(status: MatchStatus): number {
  if (IN_PLAY_MATCH_STATUSES.includes(status)) return 0;
  if (status === 'SCHEDULED') return 1;
  if (status === 'FINISHED' || status === 'AWARDED') return 2;
  return 3;
}

/**
 * Матчі стрічки головної (D55): турнір (порядок перемикача, як на `/matches`) → статус → час початку; у розмітці —
 * не більше `HOME_STRIP_MAX_MATCHES`. Масив API не змінює.
 */
export function homeStripMatches(
  matches: readonly MatchListItem[],
  orderedLeagues: League[],
): MatchListItem[] {
  const compareLeagues = compareLeaguesByOrder(orderedLeagues);
  return [...matches]
    .sort(
      (leftMatch, rightMatch) =>
        compareLeagues(leftMatch.league, rightMatch.league) ||
        statusRank(leftMatch.status) - statusRank(rightMatch.status) ||
        Date.parse(leftMatch.kickoffAt) - Date.parse(rightMatch.kickoffAt) ||
        leftMatch.id.localeCompare(rightMatch.id),
    )
    .slice(0, HOME_STRIP_MAX_MATCHES);
}
