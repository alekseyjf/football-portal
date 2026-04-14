import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readConfiguredCompetitionIds } from '../football.constants';
import { FootballSyncService } from './football-sync.service';

@Injectable()
export class FootballCronService {
  private readonly log = new Logger(FootballCronService.name);

  constructor(private readonly sync: FootballSyncService) {}

  @Cron('0 */2 * * *')
  async syncMatchesAndStandings(): Promise<void> {
    if (!process.env.FOOTBALL_API_KEY?.trim()) return;
    try {
      await this.sync.runSequentialSync(readConfiguredCompetitionIds());
      this.log.log('Плановий синк матчів і таблиці виконано');
    } catch (e) {
      this.log.warn(`Плановий синк football: ${e}`);
    }
  }

  @Cron('*/5 * * * *')
  async syncLive(): Promise<void> {
    if (process.env.FOOTBALL_LIVE_CRON_ENABLED !== 'true') return;
    if (!process.env.FOOTBALL_API_KEY?.trim()) return;
    try {
      await this.sync.syncLiveMatchesOnly();
      this.log.log('LIVE-синк (cron) виконано');
    } catch (e) {
      this.log.warn(`LIVE-синк football: ${e}`);
    }
  }
}
