import { IN_PLAY_MATCH_STATUSES, type MatchRow } from '@/lib/api/types';

/** Як часто перечитувати матчі, поки якийсь іде: LIVE-синк турніру й так не частіше 60 с. */
export const MATCHES_POLL_INTERVAL_MS = 60_000;

/** Скільки після часу початку чекати, що «заплановано» стане «наживо» (D55): далі — застарілі дані, не опитуємо. */
export const KICKOFF_STATUS_GRACE_MS = 3 * 60 * 60_000;

/** Найдовша затримка таймера браузера (2³¹ − 1 мс, ~24,8 доби): довша спрацьовує одразу. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

/**
 * Коли перечитати матчі (головна й `/matches`, D55) — значення `refetchInterval` TanStack Query: кожні 60 с, поки
 * якийсь матч у грі або його початок уже настав (не давніше 3 год тому), а статус ще «заплановано»; інакше — один раз у
 * момент найближчого початку (вкладка, відкрита до матчу, інакше не дізналася б, що він почався); попереду нічого —
 * `false`. Читає лише нашу API: квоту провайдера витрачає сторінка матчу (`live-touch`).
 */
export function matchesRefetchInterval(
  matches: readonly Pick<MatchRow, 'status' | 'kickoffAt'>[],
  now: Date,
): number | false {
  const nowMs = now.getTime();
  let nextKickoffMs = Number.POSITIVE_INFINITY;
  for (const match of matches) {
    if (IN_PLAY_MATCH_STATUSES.includes(match.status)) {
      return MATCHES_POLL_INTERVAL_MS;
    }
    if (match.status !== 'SCHEDULED') continue;
    const kickoffMs = Date.parse(match.kickoffAt);
    if (kickoffMs > nowMs) {
      nextKickoffMs = Math.min(nextKickoffMs, kickoffMs);
    } else if (nowMs - kickoffMs <= KICKOFF_STATUS_GRACE_MS) {
      return MATCHES_POLL_INTERVAL_MS;
    }
  }
  if (nextKickoffMs === Number.POSITIVE_INFINITY) return false;
  return Math.min(
    Math.max(MATCHES_POLL_INTERVAL_MS, nextKickoffMs - nowMs),
    MAX_TIMER_DELAY_MS,
  );
}
