import { RateLimitAction, SanctionReason, SanctionType } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1_000;

/** Скільки живе `RateLimitEvent` (cron). Має бути ≥ будь-якого вікна/cooldown нижче. */
export const RATE_LIMIT_EVENT_RETENTION_MS = 24 * HOUR_MS;

/** Прострочені `AuthSession` тримаємо ще тиждень (розбір інцидентів), потім cron видаляє. */
export const EXPIRED_SESSION_RETENTION_MS = 7 * 24 * HOUR_MS;

/** Друга невідкликана санкція того самого типу → блок акаунта (P2-11). */
export const ABUSE_STRIKES_LOCK_ACCOUNT = 2;

export const ACCOUNT_LOCKED_CODE = 'ACCOUNT_LOCKED';

/** Політика однієї дії (P2-9): burst → тимчасова санкція; cooldown — мінімальний інтервал. */
export interface RateLimitPolicy {
  burstWindowMs: number;
  /** Скільки подій у вікні (разом з поточною) → санкція */
  burstThreshold: number;
  sanctionType: SanctionType;
  sanctionReason: SanctionReason;
  suspensionMs: number;
  /** 403, поки санкція активна */
  suspendedCode: string;
  /** Мінімальний інтервал між діями; не минув → 429 з `code`. `null` = без cooldown */
  cooldown: { ms: number; code: string } | null;
}

const DEFAULT_COMMENT_COOLDOWN_MS = 60_000;

/** Мінімальний інтервал між коментарями (мс); перевизначити через COMMENT_COOLDOWN_MS */
export function getCommentCooldownMs(): number {
  const raw = process.env.COMMENT_COOLDOWN_MS;
  if (raw === undefined || raw === '') return DEFAULT_COMMENT_COOLDOWN_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0)
    return DEFAULT_COMMENT_COOLDOWN_MS;
  // Події старші за retention cron видаляє — довший cooldown перестав би діяти
  return Math.min(parsed, RATE_LIMIT_EVENT_RETENTION_MS);
}

export function getRateLimitPolicy(action: RateLimitAction): RateLimitPolicy {
  switch (action) {
    case RateLimitAction.LIKE:
      return {
        burstWindowMs: 5_000,
        burstThreshold: 5,
        sanctionType: SanctionType.LIKES_SUSPENDED,
        sanctionReason: SanctionReason.LIKE_BURST,
        suspensionMs: 24 * HOUR_MS,
        suspendedCode: 'LIKES_SUSPENDED',
        cooldown: null,
      };
    case RateLimitAction.COMMENT:
      return {
        burstWindowMs: 5_000,
        burstThreshold: 5,
        sanctionType: SanctionType.COMMENTS_SUSPENDED,
        sanctionReason: SanctionReason.COMMENT_BURST,
        suspensionMs: 24 * HOUR_MS,
        suspendedCode: 'COMMENTS_SUSPENDED',
        cooldown: { ms: getCommentCooldownMs(), code: 'COMMENT_COOLDOWN' },
      };
  }
}
