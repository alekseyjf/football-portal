import { useQuery } from '@tanstack/react-query';
import { useTimeZone } from 'next-intl';
import { DEFAULT_TIME_ZONE } from '@/i18n/time-zone';
import type { MatchListItem } from '@/lib/api/types';
import {
  homeStripMatches,
  matchStripDayOf,
  type MatchStripDay,
} from '@/lib/football/home-match-strip';
import {
  leaguesQueryOptions,
  matchesInRangeQueryOptions,
  nextKickoffQueryOptions,
} from './useFootball';
import { useMatchesPolling } from './useMatchesPolling';

export type HomeMatchStripState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /** Ні сьогодні, ні попереду матчів немає (міжсезоння) — блоку немає */
  | { status: 'none' }
  | {
      status: 'ready';
      day: MatchStripDay;
      /** `false` — «Найближчі матчі» іншого дня */
      isToday: boolean;
      matches: MatchListItem[];
    };

type StepQuery = {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/** Крок без даних: вантажиться (і після «Спробувати ще») або помилка; дані є — `null`, далі наступний крок. */
function pendingStep(query: StepQuery): HomeMatchStripState | null {
  if (query.data !== undefined) return null;
  if (query.isError && !query.isFetching) {
    return { status: 'error', retry: () => void query.refetch() };
  }
  return { status: 'loading' };
}

/**
 * Стрічка матчів головної (D55): матчі сьогодні в поясі читача (їх перечитує `useMatchesPolling`); сьогодні
 * порожньо — день найближчого матчу (`GET /football/matches/next-kickoff`) і матчі цього дня; немає й таких — `none`.
 * Дані — з кешу, який наповнив сервер (ті самі ключі); чого немає — клієнт вантажить сам.
 *
 * @param today сьогодні — з сервера: інакше біля півночі сервер і клієнт узяли б різні дні
 */
export function useHomeMatchStrip(today: MatchStripDay): HomeMatchStripState {
  const timeZone = useTimeZone() ?? DEFAULT_TIME_ZONE;
  const matchesPolling = useMatchesPolling();
  const leagues = useQuery(leaguesQueryOptions());
  const todayQuery = useQuery({
    ...matchesInRangeQueryOptions(today.from, today.to, null),
    ...matchesPolling,
  });
  const todayMatches = todayQuery.data?.matches;
  const isTodayEmpty = todayMatches?.length === 0;
  const nextKickoffQuery = useQuery({
    ...nextKickoffQueryOptions(today.to),
    enabled: isTodayEmpty,
  });
  const nextKickoffAt = isTodayEmpty
    ? (nextKickoffQuery.data?.kickoffAt ?? null)
    : null;
  const nextDay = nextKickoffAt
    ? matchStripDayOf(new Date(nextKickoffAt), timeZone)
    : null;
  const nextDayQuery = useQuery({
    ...matchesInRangeQueryOptions(nextDay?.from ?? '', nextDay?.to ?? '', null),
    enabled: nextDay !== null,
  });
  const orderedLeagues = leagues.data ?? [];

  const todayStep = pendingStep(todayQuery);
  if (todayStep || !todayMatches) return todayStep ?? { status: 'loading' };
  if (todayMatches.length > 0) {
    return {
      status: 'ready',
      day: today,
      isToday: true,
      matches: homeStripMatches(todayMatches, orderedLeagues),
    };
  }
  const nextKickoffStep = pendingStep(nextKickoffQuery);
  if (nextKickoffStep) return nextKickoffStep;
  if (!nextDay) return { status: 'none' };
  const nextDayStep = pendingStep(nextDayQuery);
  const nextDayMatches = nextDayQuery.data?.matches;
  if (nextDayStep || !nextDayMatches)
    return nextDayStep ?? { status: 'loading' };
  return nextDayMatches.length === 0
    ? { status: 'none' }
    : {
        status: 'ready',
        day: nextDay,
        isToday: false,
        matches: homeStripMatches(nextDayMatches, orderedLeagues),
      };
}
