import { Module } from '@nestjs/common';
import { FootballController } from './football.controller';
import { FootballCronService } from './football.cron';
import { FootballDataClient } from './football-data.client';
import { FootballLiveThrottleService } from './football-live-throttle.service';
import { FootballQueryService } from './football-query.service';
import { FootballRepository } from './football.repository';
import { FootballSyncService } from './football-sync.service';

@Module({
  controllers: [FootballController],
  providers: [
    FootballRepository,
    FootballDataClient,
    FootballLiveThrottleService,
    FootballQueryService,
    FootballSyncService,
    FootballCronService,
  ],
  exports: [FootballQueryService, FootballSyncService],
})
export class FootballModule {}
