import { Module } from '@nestjs/common';
import { FootballIntegrationModule } from '../integration/football-integration.module';
import { FootballPersistenceModule } from '../persistence/football-persistence.module';
import { FootballCronService } from './football.cron';
import { FootballLiveSyncService } from './football-live-sync.service';
import { FootballLiveThrottleService } from './football-live-throttle.service';
import { FootballSyncService } from './football-sync.service';
import { FootballSyncWriter } from './football-sync.writer';
import { SyncRunTracker } from './sync-run-tracker';

@Module({
  imports: [FootballIntegrationModule, FootballPersistenceModule],
  providers: [
    SyncRunTracker,
    FootballSyncWriter,
    FootballLiveThrottleService,
    FootballSyncService,
    FootballLiveSyncService,
    FootballCronService,
  ],
  exports: [FootballSyncService, FootballLiveSyncService],
})
export class FootballSyncModule {}
