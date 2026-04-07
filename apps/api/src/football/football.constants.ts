/** Пауза між запитами до football-data (free tier ~10 req/хв). */
export const FOOTBALL_API_DELAY_MS = 6500;

export function pauseMilliseconds(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Макс. сторінок матчів при пагінації. */
export const FOOTBALL_MATCH_PAGES_MAX = 50;

/** Мін. інтервал on-demand LIVE-синку на одне змагання (ms). */
export const FOOTBALL_LIVE_THROTTLE_MS = 90_000;

/**
 * Ідентифікатори змагань для `/v4/competitions/{ref}/…` (код або число).
 * Не плутати з API-токеном.
 */
export function readConfiguredCompetitionIds(): string[] {
  const raw =
    process.env.FOOTBALL_COMPETITION_IDS?.trim() ||
    process.env.FOOTBALL_DEFAULT_COMPETITION_ID?.trim() ||
    'PL';
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}
