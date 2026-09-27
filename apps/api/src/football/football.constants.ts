/** Мінімальний інтервал між стартами запитів до football-data (free tier — 10 / хв, F9). */
export const FOOTBALL_API_REQUEST_INTERVAL_MS = 6500;

/** Найдовше очікування перед повтором після 429 (лічильник провайдера скидається щохвилини). */
export const FOOTBALL_API_MAX_RETRY_WAIT_MS = 65_000;

export function pauseMilliseconds(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Матчів в одній транзакції синку (6.2 п. 5, P5-7). */
export const MATCH_WRITE_CHUNK_SIZE = 50;

/** Транзакція чанку: до 50 вставок з вкладеним ref — Prisma за замовчуванням дає лише 5 с. */
export const SYNC_TRANSACTION_TIMEOUT_MS = 30_000;
export const SYNC_TRANSACTION_MAX_WAIT_MS = 10_000;

/** `RUNNING` довше за це — процес помер посеред синку, лок знімається (P5-10). */
export const FULL_SYNC_STALE_AFTER_MS = 10 * 60_000;
export const LIVE_SYNC_STALE_AFTER_MS = 3 * 60_000;

/** LIVE-синк одного турніру — не частіше (P5-11; раніше 90 с у пам'яті процесу). */
export const LIVE_SYNC_MIN_INTERVAL_MS = 60_000;

/** LIVE-вікно (P5-11): запланований матч — від «за 15 хв» до «+3 год» від початку. */
export const LIVE_WINDOW_BEFORE_KICKOFF_MS = 15 * 60_000;
export const LIVE_WINDOW_AFTER_KICKOFF_MS = 3 * 60 * 60_000;
/** Матч «наживо» / перерваний, що почався давніше, — завислий статус, LIVE-синк його не тягне. */
export const LIVE_WINDOW_IN_PLAY_MAX_AGE_MS = 12 * 60 * 60_000;

/** LIVE-синк бере матчі за вчора … завтра (UTC): ловить щойно завершені (F10). */
export const LIVE_SYNC_DATE_WINDOW_DAYS = 1;
