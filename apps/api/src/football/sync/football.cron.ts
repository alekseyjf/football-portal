import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SyncTrigger } from '@prisma/client';
import { FootballLiveSyncService } from './football-live-sync.service';
import { FootballSyncService } from './football-sync.service';
import { describeSyncError } from './football-sync-stats';

@Injectable()
export class FootballCronService {
  private readonly log = new Logger(FootballCronService.name);

  constructor(
    private readonly fullSync: FootballSyncService,
    private readonly liveSync: FootballLiveSyncService,
  ) {}

  /**
   * Повний синк активних турнірів кожні 2 год (P5-14): LIVE-cron за замовчуванням вимкнено,
   * тож рідше — застарілі результати. 9 турнірів × 4 запити ≈ 4 хв.
   */
  @Cron('0 */2 * * *')
  async syncActiveCompetitions(): Promise<void> {
    try {
      await this.fullSync.syncActiveCompetitions(SyncTrigger.CRON);
    } catch (error) {
      this.log.warn(`Плановий синк football: ${describeSyncError(error)}`);
    }
  }

  /** Опційно (`FOOTBALL_LIVE_CRON_ENABLED=true`): лише турніри з матчем у LIVE-вікні. */
  @Cron('*/5 * * * *')
  async syncLiveCompetitions(): Promise<void> {
    if (process.env.FOOTBALL_LIVE_CRON_ENABLED !== 'true') return;
    try {
      await this.liveSync.syncCompetitionsInLiveWindow();
    } catch (error) {
      this.log.warn(`LIVE-синк football: ${describeSyncError(error)}`);
    }
  }
}
