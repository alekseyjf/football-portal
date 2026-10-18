import type { ApiSchemas } from '../api-schemas';

/** `POST /football/sync` (202): синк у фоні, хід — у журналі. */
export type FootballSyncAccepted = ApiSchemas['FootballSyncAcceptedDto'];

/** Запуск синку в журналі адмінки: `GET /football/sync-runs`. */
export type SyncRun = ApiSchemas['SyncRunDto'];

/** Що зроблено за запуск. */
export type SyncRunStats = ApiSchemas['SyncRunStatsDto'];
