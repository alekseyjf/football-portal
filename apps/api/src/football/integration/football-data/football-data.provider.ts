import { Injectable } from '@nestjs/common';
import { DataProvider } from '@prisma/client';
import {
  FootballProviderError,
  type FootballProvider,
  type ProviderCompetition,
  type ProviderMatch,
  type ProviderSeason,
  type ProviderSeasonClubs,
  type ProviderSeasonStandings,
} from '../football-provider.port';
import { FootballDataClient } from './football-data.client';
import {
  fdSeasonQueryYear,
  mapFdCompetition,
  mapFdMatch,
  mapFdStandingsResponse,
  mapFdTeamsResponse,
} from './football-data.mapper';
import type {
  FdCompetition,
  FdMatchesResponse,
  FdStandingsResponse,
  FdTeamsResponse,
} from './football-data.types';

function competitionPath(competitionExternalId: string): string {
  return `/competitions/${encodeURIComponent(competitionExternalId)}`;
}

/** YYYY-MM-DD в UTC — формат `dateFrom` / `dateTo` football-data. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `FootballProvider` поверх football-data.org v4. Сезон адресується роком старту
 * (`?season=2026`), тож усі запити одного синку — про той самий сезон (P5-3).
 */
@Injectable()
export class FootballDataProvider implements FootballProvider {
  readonly provider = DataProvider.FOOTBALL_DATA;

  constructor(private readonly client: FootballDataClient) {}

  isConfigured(): boolean {
    return this.client.hasApiKey();
  }

  async fetchCompetition(
    competitionExternalId: string,
  ): Promise<ProviderCompetition> {
    const fdCompetition = await this.client.getJson<FdCompetition>(
      competitionPath(competitionExternalId),
    );
    return mapFdCompetition(fdCompetition);
  }

  async fetchSeasonClubs(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderSeasonClubs> {
    const response = await this.client.getJson<FdTeamsResponse>(
      `${competitionPath(competitionExternalId)}/teams`,
      { season: fdSeasonQueryYear(season) },
    );
    return mapFdTeamsResponse(response);
  }

  async fetchSeasonMatches(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderMatch[]> {
    // `limit` / `offset` провайдер ігнорує — усі матчі сезону однією відповіддю (F1)
    const response = await this.client.getJson<FdMatchesResponse>(
      `${competitionPath(competitionExternalId)}/matches`,
      { season: fdSeasonQueryYear(season) },
    );
    return (response.matches ?? []).map(mapFdMatch);
  }

  async fetchMatchesBetween(
    competitionExternalId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<ProviderMatch[]> {
    const response = await this.client.getJson<FdMatchesResponse>(
      `${competitionPath(competitionExternalId)}/matches`,
      { dateFrom: utcDay(dateFrom), dateTo: utcDay(dateTo) },
    );
    return (response.matches ?? []).map(mapFdMatch);
  }

  async fetchSeasonStandings(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderSeasonStandings | null> {
    try {
      const response = await this.client.getJson<FdStandingsResponse>(
        `${competitionPath(competitionExternalId)}/standings`,
        { season: fdSeasonQueryYear(season) },
      );
      return mapFdStandingsResponse(response);
    } catch (error) {
      // Турнір є, а таблиці немає — напр. EC 2024 (F4)
      if (
        error instanceof FootballProviderError &&
        error.kind === 'NOT_FOUND'
      ) {
        return null;
      }
      throw error;
    }
  }
}
