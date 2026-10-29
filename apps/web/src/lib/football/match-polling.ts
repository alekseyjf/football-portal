import { IN_PLAY_MATCH_STATUSES, type MatchRow } from '@/lib/api/types';

/** Як часто перечитувати матчі, поки якийсь іде: LIVE-синк турніру й так не частіше 60 с. */
export const MATCHES_POLL_INTERVAL_MS = 60_000;

/** Скільки після часу початку чекати, що «заплановано» стане «наживо» (D55): далі — застарілі дані, не опитуємо. */
export const KICKOFF_STATUS_GRACE_MS = 3 * 60 * 60_000;

/**
 * Найбільший розкид перечитування після початку (M1.6.4): вкладки, відкриті до матчу, не приходять до API в ту саму
 * секунду. «Наживо» в БД однаково з'являється із запізненням синку — читач нічого не втрачає.
 */
export const KICKOFF_JITTER_MAX_MS = 30_000;

/**
 * Найдовший таймер до початку (M1.6.4): довгий таймер браузера відстає (сон ноутбука, фонова вкладка), а понад
 * 2³¹ − 1 мс (~24,8 доби) спрацьовує одразу. Спрацював раніше за початок — перечитує й планує заново.
 */
export const KICKOFF_TIMER_MAX_MS = 6 * 60 * 60_000;

type PolledMatch = Pick<MatchRow, 'status' | 'kickoffAt'>;

type PollingClock = {
  now: Date;
  /** Розкид цієї вкладки, 0…`KICKOFF_JITTER_MAX_MS` — сталий, щоб таймер і перевірка при поверненні збігались */
  jitterMs: number;
};

/**
 * Коли перечитати матчі (головна й `/matches`, D55) — значення `refetchInterval` TanStack Query: кожні 60 с, поки
 * якийсь матч у грі або його початок уже настав (не давніше 3 год тому), а статус ще «заплановано»; інакше — один раз
 * після найближчого початку з розкидом вкладки, не пізніше ніж через 6 год (вкладка, відкрита до матчу, інакше не
 * дізналася б, що він почався); попереду нічого — `false`. Читає лише нашу API: квоту провайдера витрачає сторінка
 * матчу (`live-touch`).
 */
export function matchesRefetchInterval(
  matches: readonly PolledMatch[],
  { now, jitterMs }: PollingClock,
): number | false {
  const nowMs = now.getTime();
  let nextRefetchMs = Number.POSITIVE_INFINITY;
  for (const match of matches) {
    if (IN_PLAY_MATCH_STATUSES.includes(match.status)) {
      return MATCHES_POLL_INTERVAL_MS;
    }
    if (match.status !== 'SCHEDULED') continue;
    const kickoffMs = Date.parse(match.kickoffAt);
    // Початок плюс розкид ще попереду — чекаємо саме його, а не 60-секундного опитування
    const refetchMs = kickoffMs + jitterMs;
    if (refetchMs > nowMs) {
      nextRefetchMs = Math.min(nextRefetchMs, refetchMs);
    } else if (nowMs - kickoffMs <= KICKOFF_STATUS_GRACE_MS) {
      return MATCHES_POLL_INTERVAL_MS;
    }
  }
  if (nextRefetchMs === Number.POSITIVE_INFINITY) return false;
  return Math.min(
    Math.max(MATCHES_POLL_INTERVAL_MS, nextRefetchMs - nowMs),
    KICKOFF_TIMER_MAX_MS,
  );
}

/**
 * Чи настав момент перечитати, поки вкладка була прихована (M1.6.4) — значення `refetchOnWindowFocus`: прихована
 * вкладка таймер пропускає, а наступний його крок — лише через цілий інтервал. Момент — той, що порахував таймер
 * після останнього завантаження (`fetchedAt`); минув — перечитати, ні — чекати таймера.
 */
export function isMatchesRefetchDue(
  matches: readonly PolledMatch[],
  { fetchedAt, now, jitterMs }: PollingClock & { fetchedAt: Date },
): boolean {
  const interval = matchesRefetchInterval(matches, {
    now: fetchedAt,
    jitterMs,
  });
  return interval !== false && fetchedAt.getTime() + interval <= now.getTime();
}
