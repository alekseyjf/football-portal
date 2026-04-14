import { Module } from '@nestjs/common';
import { FootballIntegrationModule } from '../integration/football-integration.module';
import { FootballPersistenceModule } from '../persistence/football-persistence.module';
import { FootballCronService } from './football.cron';
import { FootballLiveThrottleService } from './football-live-throttle.service';
import { FootballSyncService } from './football-sync.service';

@Module({
  imports: [FootballIntegrationModule, FootballPersistenceModule],
  providers: [
    FootballLiveThrottleService,
    FootballSyncService,
    FootballCronService,
  ],
  exports: [FootballSyncService],
})
export class FootballSyncModule {}
