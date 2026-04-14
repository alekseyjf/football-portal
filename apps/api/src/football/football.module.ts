import { Module } from '@nestjs/common';
import { FootballController } from './football.controller';
import { FootballQueryModule } from './query/football-query.module';
import { FootballSyncModule } from './sync/football-sync.module';

/**
 * Кореневий модуль футболу: підмодулі query (читання БД), sync (імпорт + LIVE + cron).
 * Інтеграція зовнішнього API — у FootballIntegrationModule (підключений з FootballSyncModule).
 */
@Module({
  imports: [FootballQueryModule, FootballSyncModule],
  controllers: [FootballController],
  exports: [FootballQueryModule, FootballSyncModule],
})
export class FootballModule {}
