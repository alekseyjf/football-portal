import { Module } from '@nestjs/common';
import { FootballRepository } from './football.repository';

@Module({
  providers: [FootballRepository],
  exports: [FootballRepository],
})
export class FootballPersistenceModule {}
