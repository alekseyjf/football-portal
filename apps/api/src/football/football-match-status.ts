import { MatchStatus } from '@prisma/client';
import {
  LIVE_WINDOW_AFTER_KICKOFF_MS,
  LIVE_WINDOW_BEFORE_KICKOFF_MS,
  LIVE_WINDOW_IN_PLAY_MAX_AGE_MS,
} from './football.constants';

/** Матч іде зараз: «наживо» в UI, у турах — серед найближчих. `PAUSED` — перерва (HT). */
export const IN_PLAY_MATCH_STATUSES: readonly MatchStatus[] = [
  MatchStatus.LIVE,
  MatchStatus.PAUSED,
];

/** Гра йде або перервана — варто тягнути LIVE-оновлення (P5-11). */
export const LIVE_SYNC_MATCH_STATUSES: readonly MatchStatus[] = [
  ...IN_PLAY_MATCH_STATUSES,
  MatchStatus.SUSPENDED,
];

export type LiveWindowMatch = { status: MatchStatus; kickoffAt: Date };

/** Межі LIVE-вікна за часом початку — ті самі для перевірки матчу й вибірки турнірів з БД. */
export function liveWindowBounds(now: Date) {
  return {
    scheduledKickoffFrom: new Date(
      now.getTime() - LIVE_WINDOW_AFTER_KICKOFF_MS,
    ),
    scheduledKickoffTo: new Date(now.getTime() + LIVE_WINDOW_BEFORE_KICKOFF_MS),
    inPlayKickoffFrom: new Date(now.getTime() - LIVE_WINDOW_IN_PLAY_MAX_AGE_MS),
  };
}

/**
 * Чи варто зараз тягнути LIVE-дані для матчу (P5-11): статус у БД «гра йде» — або матч
 * запланований і час початку поруч. Друге — щоб матч узагалі міг стати LIVE: у БД він
 * LIVE лише після синку (F10).
 */
export function isMatchInLiveWindow(
  match: LiveWindowMatch,
  now: Date,
): boolean {
  const bounds = liveWindowBounds(now);
  const kickoffTime = match.kickoffAt.getTime();
  if (LIVE_SYNC_MATCH_STATUSES.includes(match.status)) {
    return kickoffTime >= bounds.inPlayKickoffFrom.getTime();
  }
  return (
    match.status === MatchStatus.SCHEDULED &&
    kickoffTime >= bounds.scheduledKickoffFrom.getTime() &&
    kickoffTime <= bounds.scheduledKickoffTo.getTime()
  );
}
