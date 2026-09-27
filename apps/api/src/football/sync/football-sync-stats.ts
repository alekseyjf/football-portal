import { FootballProviderError } from '../integration/football-provider.port';

/** `SyncRun.stats` (6.2 п. 7): що зроблено за запуск — видно в адмінці. */
export type SyncStats = {
  apiCalls: number;
  seasonLabel: string | null;
  /** Поточний сезон турніру змінився цим запуском (6.2 п. 8) */
  seasonChanged: boolean;
  clubsCreated: number;
  clubsUpdated: number;
  seasonClubs: number;
  matchesCreated: number;
  matchesUpdated: number;
  /** Без змін за `payloadHash` — жодного запису (P5-6) */
  matchesSkipped: number;
  /** Учасник ще не визначений (плей-оф до жеребкування) */
  matchesUndecided: number;
  /** LIVE: матчу ще немає в БД — створить повний синк (P5-11) */
  matchesUnknown: number;
  matchesFailed: number;
  standingsTables: number;
  standingsRows: number;
  standingsFailed: number;
  /** Провайдер таблиць для сезону не має (F4) */
  standingsUnavailable: boolean;
};

export function createSyncStats(): SyncStats {
  return {
    apiCalls: 0,
    seasonLabel: null,
    seasonChanged: false,
    clubsCreated: 0,
    clubsUpdated: 0,
    seasonClubs: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    matchesSkipped: 0,
    matchesUndecided: 0,
    matchesUnknown: 0,
    matchesFailed: 0,
    standingsTables: 0,
    standingsRows: 0,
    standingsFailed: 0,
    standingsUnavailable: false,
  };
}

/** Частину записів не збережено — запуск `PARTIAL`, а не `SUCCEEDED`. */
export function hasPartialFailures(stats: SyncStats): boolean {
  return stats.matchesFailed > 0 || stats.standingsFailed > 0;
}

/** Текст для `SyncRun.errorMessage`: без тіла відповіді провайдера й заголовків (там ключ). */
export function describeSyncError(error: unknown): string {
  if (error instanceof FootballProviderError) {
    return `${error.kind}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
