import { Inject, Injectable, Logger } from '@nestjs/common';
import { SyncStatus, SyncTrigger } from '@prisma/client';
import { LIVE_SYNC_DATE_WINDOW_DAYS } from '../football.constants';
import { isMatchInLiveWindow } from '../football-match-status';
import {
  FOOTBALL_PROVIDER,
  type FootballProvider,
  type ProviderClubRef,
  type ProviderSeason,
} from '../integration/football-provider.port';
import {
  FootballSyncRepository,
  type CurrentSeasonForSync,
  type SyncTargetCompetition,
} from '../persistence/football-sync.repository';
import { SyncRunRepository } from '../persistence/sync-run.repository';
import { FootballLiveThrottleService } from './football-live-throttle.service';
import {
  createSyncStats,
  describeSyncError,
  hasPartialFailures,
  type SyncStats,
} from './football-sync-stats';
import { FootballSyncWriter } from './football-sync.writer';

const DAY_MS = 24 * 60 * 60_000;

export type LiveTouchResult = {
  accepted: boolean;
  skipped?: 'not_found' | 'not_live' | 'throttled' | 'no_api_key';
};

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Сезон з БД у формі, якою провайдер його адресує (таблиця після LIVE). */
function toProviderSeason(
  season: CurrentSeasonForSync & { externalId: string },
): ProviderSeason {
  return {
    externalId: season.externalId,
    label: season.label,
    startDate: toIsoDay(season.startDate),
    endDate: toIsoDay(season.endDate),
    currentMatchday: season.currentMatchday,
  };
}

/**
 * LIVE-оновлення (P5-11): матчі турніру за вчора … завтра, лише **оновлення** наявних
 * (створює повний синк під своїм локом). Матч став `FINISHED` → оновити таблицю.
 */
@Injectable()
export class FootballLiveSyncService {
  private readonly log = new Logger(FootballLiveSyncService.name);

  constructor(
    @Inject(FOOTBALL_PROVIDER) private readonly provider: FootballProvider,
    private readonly syncRepository: FootballSyncRepository,
    private readonly syncRuns: SyncRunRepository,
    private readonly liveThrottle: FootballLiveThrottleService,
    private readonly writer: FootballSyncWriter,
  ) {}

  /**
   * `POST /football/live-touch` (P5-12): матч у LIVE-вікні — не лише зі статусом `LIVE` у БД,
   * інакше матч ніколи б не «ожив» (F10). Синк — у фоні.
   */
  async requestLiveSyncForMatch(matchId: string): Promise<LiveTouchResult> {
    const liveContext = await this.syncRepository.findMatchLiveContext(
      matchId,
      this.provider.provider,
    );
    if (!liveContext) return { accepted: false, skipped: 'not_found' };
    if (
      !liveContext.competition ||
      !isMatchInLiveWindow(liveContext, new Date())
    ) {
      return { accepted: false, skipped: 'not_live' };
    }
    if (!this.provider.isConfigured()) {
      return { accepted: false, skipped: 'no_api_key' };
    }
    const competition = liveContext.competition;
    const runId = await this.liveThrottle.tryStartLiveRun(
      competition.slug,
      SyncTrigger.LIVE_TOUCH,
    );
    if (!runId) return { accepted: false, skipped: 'throttled' };
    void this.runLiveSync(runId, competition);
    return { accepted: true };
  }

  /** LIVE-cron: активні турніри з матчем у LIVE-вікні, послідовно. */
  async syncCompetitionsInLiveWindow(): Promise<void> {
    if (!this.provider.isConfigured()) return;
    const competitions = await this.syncRepository.findCompetitionsInLiveWindow(
      this.provider.provider,
      new Date(),
    );
    for (const competition of competitions) {
      const runId = await this.liveThrottle.tryStartLiveRun(
        competition.slug,
        SyncTrigger.CRON,
      );
      if (runId) await this.runLiveSync(runId, competition);
    }
  }

  /** Не кидає: результат — у `SyncRun`. */
  private async runLiveSync(
    runId: string,
    competition: SyncTargetCompetition,
  ): Promise<void> {
    const stats = createSyncStats();
    let status: SyncStatus = SyncStatus.FAILED;
    let errorMessage: string | undefined;
    try {
      status = await this.syncLiveMatches(competition, stats);
    } catch (error) {
      errorMessage = describeSyncError(error);
      this.log.warn(`LIVE-синк ${competition.slug}: ${errorMessage}`);
    }
    try {
      await this.syncRuns.finish(runId, status, stats, errorMessage);
    } catch (error) {
      this.log.error(
        `SyncRun ${runId} не закрито: ${describeSyncError(error)}`,
      );
    }
  }

  private async syncLiveMatches(
    competition: SyncTargetCompetition,
    stats: SyncStats,
  ): Promise<SyncStatus> {
    const syncedAt = new Date();
    const windowMs = LIVE_SYNC_DATE_WINDOW_DAYS * DAY_MS;

    stats.apiCalls += 1;
    const providerMatches = await this.provider.fetchMatchesBetween(
      competition.externalId,
      new Date(syncedAt.getTime() - windowMs),
      new Date(syncedAt.getTime() + windowMs),
    );
    const clubIdByExternalId = await this.writer.resolveKnownClubs(
      providerMatches.flatMap((providerMatch) =>
        [providerMatch.homeClub, providerMatch.awayClub].filter(
          (clubRef): clubRef is ProviderClubRef => clubRef !== null,
        ),
      ),
    );
    const { finishedNowCount } = await this.writer.applyMatches(
      providerMatches,
      clubIdByExternalId,
      null,
      stats,
      syncedAt,
    );

    if (finishedNowCount > 0) {
      await this.refreshStandings(competition, stats);
    }
    return hasPartialFailures(stats)
      ? SyncStatus.PARTIAL
      : SyncStatus.SUCCEEDED;
  }

  /** Після завершеного матчу таблиця змінилась — +1 запит (P5-11). */
  private async refreshStandings(
    competition: SyncTargetCompetition,
    stats: SyncStats,
  ): Promise<void> {
    const season = await this.syncRepository.findCurrentSeasonForSync(
      competition.id,
      this.provider.provider,
    );
    if (!season?.externalId) return;
    const providerSeason = toProviderSeason({
      ...season,
      externalId: season.externalId,
    });
    stats.seasonLabel = season.label;

    stats.apiCalls += 1;
    const standings = await this.provider.fetchSeasonStandings(
      competition.externalId,
      providerSeason,
    );
    if (!standings) {
      stats.standingsUnavailable = true;
      return;
    }
    if (standings.seasonExternalId !== season.externalId) return;
    const clubIdByExternalId = await this.writer.resolveKnownClubs(
      standings.tables.flatMap((table) =>
        table.rows.map((standingRow) => standingRow.club),
      ),
    );
    await this.writer.applyStandings(
      season.id,
      standings.tables,
      clubIdByExternalId,
      stats,
    );
  }
}
