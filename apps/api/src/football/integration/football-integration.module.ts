import { Module } from '@nestjs/common';
import { FootballDataClient } from './football-data.client';

/**
 * Зовнішнє API (football-data.org): HTTP-клієнт. Маппер — чисті функції з football.mapper.ts.
 * При зміні провайдера додати паралельний клієнт або замінити реалізацію тут.
 */
@Module({
  providers: [FootballDataClient],
  exports: [FootballDataClient],
})
export class FootballIntegrationModule {}
