import { Module } from '@nestjs/common';
import { FootballPersistenceModule } from '../persistence/football-persistence.module';
import { FootballAdminQueryService } from './football-admin-query.service';
import { FootballQueryService } from './football-query.service';

@Module({
  imports: [FootballPersistenceModule],
  providers: [FootballQueryService, FootballAdminQueryService],
  exports: [FootballQueryService, FootballAdminQueryService],
})
export class FootballQueryModule {}
