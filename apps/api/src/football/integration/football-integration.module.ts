import { Module } from '@nestjs/common';
import { FootballDataClient } from './football-data/football-data.client';
import { FootballDataProvider } from './football-data/football-data.provider';
import { FOOTBALL_PROVIDER } from './football-provider.port';

/**
 * Зовнішній постачальник даних за DI-токеном `FOOTBALL_PROVIDER` (розділ 6.1).
 * Інший провайдер = інший адаптер тут; синк і репозиторії не змінюються.
 */
@Module({
  providers: [
    FootballDataClient,
    { provide: FOOTBALL_PROVIDER, useClass: FootballDataProvider },
  ],
  exports: [FOOTBALL_PROVIDER],
})
export class FootballIntegrationModule {}
