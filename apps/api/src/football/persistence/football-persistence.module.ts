import { Module } from '@nestjs/common';
import { ExternalRefRepository } from './external-ref.repository';
import { FootballAdminRepository } from './football-admin.repository';
import { FootballSyncRepository } from './football-sync.repository';
import { FootballRepository } from './football.repository';
import { SyncRunRepository } from './sync-run.repository';

@Module({
  providers: [
    FootballRepository,
    FootballAdminRepository,
    FootballSyncRepository,
    ExternalRefRepository,
    SyncRunRepository,
  ],
  exports: [
    FootballRepository,
    FootballAdminRepository,
    FootballSyncRepository,
    ExternalRefRepository,
    SyncRunRepository,
  ],
})
export class FootballPersistenceModule {}
