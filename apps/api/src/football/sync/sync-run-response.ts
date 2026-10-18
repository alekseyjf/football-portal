import type { Prisma } from '@prisma/client';
import type {
  SyncRunDto,
  SyncRunStatsDto,
} from '../dto/football-sync-response.dto';
import type { SyncRunRow } from '../persistence/sync-run.repository';

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCounter(value: Prisma.JsonValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * `SyncRun.stats` — JSON, який пише синк (`SyncStats`). Поля — явно: старий рядок без нового лічильника
 * дає 0, а не `undefined`, і зайве з JSON у відповідь не потрапляє. Не об'єкт — запуск ще йде
 * або знятий як застарілий.
 */
function toSyncRunStats(stats: Prisma.JsonValue): SyncRunStatsDto | null {
  if (!isJsonObject(stats)) return null;
  return {
    apiCalls: readCounter(stats.apiCalls),
    seasonLabel:
      typeof stats.seasonLabel === 'string' ? stats.seasonLabel : null,
    seasonChanged: stats.seasonChanged === true,
    clubsCreated: readCounter(stats.clubsCreated),
    clubsUpdated: readCounter(stats.clubsUpdated),
    seasonClubs: readCounter(stats.seasonClubs),
    matchesCreated: readCounter(stats.matchesCreated),
    matchesUpdated: readCounter(stats.matchesUpdated),
    matchesSkipped: readCounter(stats.matchesSkipped),
    matchesUndecided: readCounter(stats.matchesUndecided),
    matchesUnknown: readCounter(stats.matchesUnknown),
    matchesFailed: readCounter(stats.matchesFailed),
    standingsTables: readCounter(stats.standingsTables),
    standingsRows: readCounter(stats.standingsRows),
    standingsFailed: readCounter(stats.standingsFailed),
    standingsUnavailable: stats.standingsUnavailable === true,
  };
}

/** Запуск у журналі адмінки (`GET /football/sync-runs`). */
export function toSyncRunView(syncRun: SyncRunRow): SyncRunDto {
  return {
    id: syncRun.id,
    provider: syncRun.provider,
    scope: syncRun.scope,
    targetRef: syncRun.targetRef,
    trigger: syncRun.trigger,
    status: syncRun.status,
    startedAt: syncRun.startedAt,
    finishedAt: syncRun.finishedAt,
    stats: toSyncRunStats(syncRun.stats),
    errorMessage: syncRun.errorMessage,
  };
}
