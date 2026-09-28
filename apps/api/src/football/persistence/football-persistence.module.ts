import { Module } from '@nestjs/common';
import { ExternalRefRepository } from './external-ref.repository';
import { FootballSyncRepository } from './football-sync.repository';
import { FootballRepository } from './football.repository';
import { SyncRunRepository } from './sync-run.repository';

@Module({
  providers: [
    FootballRepository,
    FootballSyncRepository,
    ExternalRefRepository,
    SyncRunRepository,
  ],
  exports: [
    FootballRepository,
    FootballSyncRepository,
    ExternalRefRepository,
    SyncRunRepository,
  ],
})
export class FootballPersistenceModule {}
