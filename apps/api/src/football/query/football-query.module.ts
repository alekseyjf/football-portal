import { Module } from '@nestjs/common';
import { FootballPersistenceModule } from '../persistence/football-persistence.module';
import { FootballQueryService } from './football-query.service';

@Module({
  imports: [FootballPersistenceModule],
  providers: [FootballQueryService],
  exports: [FootballQueryService],
})
export class FootballQueryModule {}
