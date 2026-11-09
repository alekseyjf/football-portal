import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SyncTrigger } from '@prisma/client';
import { envConfig } from '../../config/env.config';
import type { AppEnv } from '../../config/env.schema';
import { FootballLiveSyncService } from './football-live-sync.service';
import { FootballSyncService } from './football-sync.service';
import { describeSyncError } from './football-sync-stats';

@Injectable()
export class FootballCronService implements OnApplicationBootstrap {
  private readonly log = new Logger(FootballCronService.name);
  private readonly syncCronEnabled: boolean;
  private readonly liveCronEnabled: boolean;

  constructor(
    private readonly fullSync: FootballSyncService,
    private readonly liveSync: FootballLiveSyncService,
    @Inject(envConfig.KEY) env: AppEnv,
  ) {
    this.syncCronEnabled = env.FOOTBALL_SYNC_CRON_ENABLED;
    this.liveCronEnabled = env.FOOTBALL_LIVE_CRON_ENABLED;
  }

  /** Вимкнений плановий синк видно в лозі старту: інакше «таблиці не оновлюються» шукали б у коді. */
  onApplicationBootstrap(): void {
    if (!this.syncCronEnabled) {
      this.log.log(
        'Плановий синк football вимкнено (FOOTBALL_SYNC_CRON_ENABLED=false): синк — кнопкою в адмінці',
      );
    }
  }

  /**
   * Повний синк активних турнірів кожні 2 год (P5-14): LIVE-cron за замовчуванням вимкнено,
   * тож рідше — застарілі результати. 9 турнірів × 4 запити ≈ 4 хв.
   * Лише з `FOOTBALL_SYNC_CRON_ENABLED=true` (тест, прод; D36): локально синк — кнопкою.
   */
  @Cron('0 */2 * * *')
  async syncActiveCompetitions(): Promise<void> {
    if (!this.syncCronEnabled) return;
    try {
      await this.fullSync.syncActiveCompetitions(SyncTrigger.CRON);
    } catch (error) {
      this.log.warn(`Плановий синк football: ${describeSyncError(error)}`);
    }
  }

  /** Опційно (`FOOTBALL_LIVE_CRON_ENABLED=true`): лише турніри з матчем у LIVE-вікні. */
  @Cron('*/5 * * * *')
  async syncLiveCompetitions(): Promise<void> {
    if (!this.liveCronEnabled) return;
    try {
      await this.liveSync.syncCompetitionsInLiveWindow();
    } catch (error) {
      this.log.warn(`LIVE-синк football: ${describeSyncError(error)}`);
    }
  }
}
