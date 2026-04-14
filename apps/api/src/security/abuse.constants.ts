/** Вікно для підрахунку «швидких» POST /likes */
export const LIKE_BURST_WINDOW_MS = 5_000;

/** Скільки запитів у вікні → 24h бан на лайки (+ другий раз → блок акаунта) */
export const LIKE_BURST_THRESHOLD = 5;

export const LIKE_SUSPENSION_MS = 24 * 60 * 60 * 1_000;

/** Друге спрацьовування бану лайків → accountLockedAt */
export const ABUSE_STRIKES_LOCK_ACCOUNT = 2;

export const COMMENT_BURST_WINDOW_MS = 5_000;
export const COMMENT_BURST_THRESHOLD = 5;
export const COMMENT_SUSPENSION_MS = 24 * 60 * 60 * 1_000;

/** Мінімальний інтервал між коментарями (мс); перевизначити через COMMENT_COOLDOWN_MS */
export function getCommentCooldownMs(): number {
  const raw = process.env.COMMENT_COOLDOWN_MS;
  if (raw === undefined || raw === '') return 60_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60_000;
}
