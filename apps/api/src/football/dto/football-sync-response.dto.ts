import { ApiProperty } from '@nestjs/swagger';
import {
  DataProvider,
  SyncScope,
  SyncStatus,
  SyncTrigger,
} from '@prisma/client';

/** `POST /football/sync`: синк поставлено в чергу, хід — у `GET /football/sync-runs`. */
export class FootballSyncAcceptedDto {
  @ApiProperty({ enum: ['accepted'] })
  status!: 'accepted';

  /** Slug-и турнірів у черзі */
  competitions!: string[];
}

/** Що зроблено за запуск синку. */
export class SyncRunStatsDto {
  apiCalls!: number;
  seasonLabel!: string | null;
  /** Поточний сезон турніру змінився цим запуском */
  seasonChanged!: boolean;
  clubsCreated!: number;
  clubsUpdated!: number;
  seasonClubs!: number;
  matchesCreated!: number;
  matchesUpdated!: number;
  /** Без змін — нічого не записано */
  matchesSkipped!: number;
  /** Учасник ще не визначений (плей-оф до жеребкування) */
  matchesUndecided!: number;
  /** LIVE: матчу ще немає в БД — створить повний синк */
  matchesUnknown!: number;
  matchesFailed!: number;
  standingsTables!: number;
  standingsRows!: number;
  standingsFailed!: number;
  /** Провайдер таблиць для сезону не має */
  standingsUnavailable!: boolean;
}

/** Запуск синку в журналі адмінки. */
export class SyncRunDto {
  id!: string;

  @ApiProperty({ enum: DataProvider, enumName: 'DataProvider' })
  provider!: DataProvider;

  /** `COMPETITION_FULL` — повний синк турніру, `MATCHES_LIVE` — LIVE-оновлення матчів */
  @ApiProperty({ enum: SyncScope, enumName: 'SyncScope' })
  scope!: SyncScope;

  /** Slug турніру */
  targetRef!: string;

  @ApiProperty({ enum: SyncTrigger, enumName: 'SyncTrigger' })
  trigger!: SyncTrigger;

  @ApiProperty({ enum: SyncStatus, enumName: 'SyncStatus' })
  status!: SyncStatus;

  startedAt!: Date;
  /** `null` — запуск ще йде */
  finishedAt!: Date | null;
  /** `null` — запуск ще йде або знятий як застарілий (`errorMessage` — `STALE: …`) */
  stats!: SyncRunStatsDto | null;
  errorMessage!: string | null;
}
