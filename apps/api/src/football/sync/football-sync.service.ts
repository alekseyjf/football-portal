import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SyncScope, SyncStatus, SyncTrigger } from '@prisma/client';
import { FULL_SYNC_STALE_AFTER_MS } from '../football.constants';
import {
  FOOTBALL_PROVIDER,
  FootballProviderError,
  type FootballProvider,
  type ProviderClubRef,
  type ProviderSeason,
} from '../integration/football-provider.port';
import {
  FootballSyncRepository,
  type SyncTargetCompetition,
} from '../persistence/football-sync.repository';
import {
  SyncRunRepository,
  type SyncRunRow,
} from '../persistence/sync-run.repository';
import {
  createSyncStats,
  describeSyncError,
  hasPartialFailures,
  type SyncStats,
} from './football-sync-stats';
import { FootballSyncWriter } from './football-sync.writer';

export type FullSyncOutcome =
  | { status: SyncStatus; runId: string }
  | { status: 'ALREADY_RUNNING' };

function assertSameSeason(
  responseSeasonExternalId: string,
  season: ProviderSeason,
  resourceName: string,
): void {
  if (responseSeasonExternalId !== season.externalId) {
    throw new FootballProviderError(
      'INVALID_RESPONSE',
      `${resourceName}: сезон ${responseSeasonExternalId} замість ${season.externalId} — провайдер перемкнув сезон посеред синку`,
    );
  }
}

/**
 * Повний синк турніру (6.2): Area → Competition → Season → Clubs + SeasonClub → Matches →
 * Standings. Рівно 4 запити до провайдера (P5-3). Один запуск на турнір — лок `SyncRun`.
 */
@Injectable()
export class FootballSyncService {
  private readonly log = new Logger(FootballSyncService.name);

  constructor(
    @Inject(FOOTBALL_PROVIDER) private readonly provider: FootballProvider,
    private readonly syncRepository: FootballSyncRepository,
    private readonly syncRuns: SyncRunRepository,
    private readonly writer: FootballSyncWriter,
  ) {}

  /**
   * `POST /football/sync`: турніри перевіряються одразу (400 / 503), синк — у фоні послідовно,
   * відповідь 202 не чекає. Хід і результат — у `SyncRun` (адмінка).
   */
  async requestFullSync(competitionSlugs?: string[]): Promise<string[]> {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('FOOTBALL_PROVIDER_NOT_CONFIGURED');
    }
    const competitions = await this.resolveSyncTargets(competitionSlugs);
    void this.syncCompetitionsSequentially(
      competitions,
      SyncTrigger.ADMIN,
    ).catch((error: unknown) => {
      this.log.error(`Фоновий синк: ${describeSyncError(error)}`);
    });
    return competitions.map((competition) => competition.slug);
  }

  /** Журнал для адмінки (6.2 п. 7). */
  getRecentRuns(limit: number): Promise<SyncRunRow[]> {
    return this.syncRuns.findRecent(limit);
  }

  /** Cron: усі активні турніри (D7). */
  async syncActiveCompetitions(trigger: SyncTrigger): Promise<void> {
    if (!this.provider.isConfigured()) return;
    await this.syncCompetitionsSequentially(
      await this.resolveSyncTargets(),
      trigger,
    );
  }

  /** Послідовно (6.2 п. 10): провайдер і так обслуговує запити однією чергою. */
  async syncCompetitionsSequentially(
    competitions: SyncTargetCompetition[],
    trigger: SyncTrigger,
  ): Promise<void> {
    for (const competition of competitions) {
      await this.syncCompetition(competition, trigger);
    }
  }

  /** Не кидає: помилка — у `SyncRun.errorMessage`, наступний турнір синкається далі. */
  async syncCompetition(
    competition: SyncTargetCompetition,
    trigger: SyncTrigger,
  ): Promise<FullSyncOutcome> {
    const runId = await this.syncRuns.tryStart(
      {
        provider: this.provider.provider,
        scope: SyncScope.COMPETITION_FULL,
        targetRef: competition.slug,
      },
      { trigger, staleAfterMs: FULL_SYNC_STALE_AFTER_MS },
    );
    if (!runId) {
      this.log.log(`Синк ${competition.slug} уже йде — пропущено`);
      return { status: 'ALREADY_RUNNING' };
    }

    const stats = createSyncStats();
    let status: SyncStatus = SyncStatus.FAILED;
    let errorMessage: string | undefined;
    try {
      status = await this.runFullSync(competition, stats);
    } catch (error) {
      errorMessage = describeSyncError(error);
      this.log.warn(`Синк ${competition.slug}: ${errorMessage}`);
    }
    try {
      await this.syncRuns.finish(runId, status, stats, errorMessage);
    } catch (error) {
      // Не закритий запуск зніме `tryStart` як застарілий (P5-10)
      this.log.error(
        `SyncRun ${runId} не закрито: ${describeSyncError(error)}`,
      );
    }
    this.log.log(
      `Синк ${competition.slug}: ${status} (${JSON.stringify(stats)})`,
    );
    return { status, runId };
  }

  private async runFullSync(
    competition: SyncTargetCompetition,
    stats: SyncStats,
  ): Promise<SyncStatus> {
    const syncedAt = new Date();
    const competitionExternalId = competition.externalId;

    stats.apiCalls += 1;
    const providerCompetition = await this.provider.fetchCompetition(
      competitionExternalId,
    );
    await this.writer.applyCompetition(
      competition.id,
      providerCompetition,
      syncedAt,
    );
    const providerSeason = providerCompetition.currentSeason;
    if (!providerSeason) {
      throw new FootballProviderError(
        'INVALID_RESPONSE',
        `${competition.slug}: провайдер не повернув поточний сезон`,
      );
    }
    const seasonId = await this.writer.applyCurrentSeason(
      competition.id,
      providerSeason,
      stats,
      syncedAt,
    );

    stats.apiCalls += 1;
    const seasonClubs = await this.provider.fetchSeasonClubs(
      competitionExternalId,
      providerSeason,
    );
    assertSameSeason(seasonClubs.seasonExternalId, providerSeason, 'teams');
    const clubIdByExternalId = await this.writer.applySeasonClubs(
      seasonClubs.clubs,
      stats,
      syncedAt,
    );
    if (seasonClubs.clubs.length > 0) {
      await this.syncRepository.replaceSeasonClubs(seasonId, [
        ...new Set(
          seasonClubs.clubs.map(
            (club) => clubIdByExternalId.get(club.externalId)!,
          ),
        ),
      ]);
    }
    stats.seasonClubs = seasonClubs.clubs.length;

    stats.apiCalls += 1;
    const providerMatches = await this.provider.fetchSeasonMatches(
      competitionExternalId,
      providerSeason,
    );
    for (const providerMatch of providerMatches) {
      assertSameSeason(
        providerMatch.seasonExternalId,
        providerSeason,
        'matches',
      );
    }
    await this.writer.ensureClubsExist(
      providerMatches.flatMap((providerMatch) =>
        [providerMatch.homeClub, providerMatch.awayClub].filter(
          (clubRef): clubRef is ProviderClubRef => clubRef !== null,
        ),
      ),
      providerCompetition.participantKind,
      clubIdByExternalId,
      stats,
      syncedAt,
    );
    await this.writer.applyMatches(
      providerMatches,
      clubIdByExternalId,
      { competitionId: competition.id, seasonId },
      stats,
      syncedAt,
    );

    stats.apiCalls += 1;
    const standings = await this.provider.fetchSeasonStandings(
      competitionExternalId,
      providerSeason,
    );
    if (!standings) {
      stats.standingsUnavailable = true;
    } else {
      assertSameSeason(standings.seasonExternalId, providerSeason, 'standings');
      await this.writer.ensureClubsExist(
        standings.tables.flatMap((table) =>
          table.rows.map((standingRow) => standingRow.club),
        ),
        providerCompetition.participantKind,
        clubIdByExternalId,
        stats,
        syncedAt,
      );
      await this.writer.applyStandings(
        seasonId,
        standings.tables,
        clubIdByExternalId,
        stats,
      );
    }

    return hasPartialFailures(stats)
      ? SyncStatus.PARTIAL
      : SyncStatus.SUCCEEDED;
  }

  /**
   * Без `slugs` — активні турніри з посиланням на провайдера (D7, 6.2 п. 9); зі `slugs` —
   * рівно вони, невідомий або без посилання → 400 `UNKNOWN_COMPETITION` (P5-13).
   */
  private async resolveSyncTargets(
    competitionSlugs?: string[],
  ): Promise<SyncTargetCompetition[]> {
    const requestedSlugs = competitionSlugs?.length
      ? [...new Set(competitionSlugs)]
      : undefined;
    const competitions = await this.syncRepository.findCompetitionsForSync(
      this.provider.provider,
      requestedSlugs,
    );
    const syncableCompetitions = competitions.flatMap((competition) =>
      competition.externalId
        ? [{ ...competition, externalId: competition.externalId }]
        : [],
    );
    if (
      requestedSlugs &&
      syncableCompetitions.length !== requestedSlugs.length
    ) {
      throw new BadRequestException('UNKNOWN_COMPETITION');
    }
    return syncableCompetitions;
  }
}
