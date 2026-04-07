import { Injectable, NotFoundException } from '@nestjs/common';
import { FootballRepository } from './football.repository';
import { groupMatchesByMatchday } from './football-matchday.util';

/**
 * Усі read-only сценарії футболу з БД.
 * Один метод `leagueBySlugOrThrow` — єдина точка перевірки slug.
 */
@Injectable()
export class FootballQueryService {
  constructor(private readonly footballRepository: FootballRepository) {}

  private async leagueBySlugOrThrow(slug: string) {
    const league = await this.footballRepository.findLeagueBySlug(slug);
    if (!league) throw new NotFoundException('Лігу не знайдено');
    return league;
  }

  getLeagues() {
    return this.footballRepository.findLeagues();
  }

  getLeagueBySlug(slug: string) {
    return this.leagueBySlugOrThrow(slug);
  }

  async getLeagueMatches(slug: string, page: number, limit: number) {
    const league = await this.leagueBySlugOrThrow(slug);
    return this.footballRepository.findMatchesByLeague(league.id, page, limit);
  }

  async getLeagueStandings(slug: string) {
    const league = await this.leagueBySlugOrThrow(slug);
    return this.footballRepository.findStandingsByLeague(league.id);
  }

  async getLeagueFixtures(slug: string) {
    const league = await this.leagueBySlugOrThrow(slug);
    const [upcomingMatches, pastMatches] = await Promise.all([
      this.footballRepository.findUpcomingMatchesByLeague(league.id),
      this.footballRepository.findPastMatchesByLeague(league.id),
    ]);
    return {
      upcoming: groupMatchesByMatchday(upcomingMatches, 'asc'),
      past: groupMatchesByMatchday(pastMatches, 'desc'),
    };
  }

  /** Один round-trip для сайдбару: таблиця + тури. */
  async getLeagueDashboard(slug: string) {
    const league = await this.leagueBySlugOrThrow(slug);
    const [standingsRows, upcomingMatches, pastMatches] = await Promise.all([
      this.footballRepository.findStandingsByLeague(league.id),
      this.footballRepository.findUpcomingMatchesByLeague(league.id),
      this.footballRepository.findPastMatchesByLeague(league.id),
    ]);
    return {
      league,
      standings: standingsRows,
      fixtures: {
        upcoming: groupMatchesByMatchday(upcomingMatches, 'asc'),
        past: groupMatchesByMatchday(pastMatches, 'desc'),
      },
    };
  }

  async getMatchById(id: string) {
    const match = await this.footballRepository.findMatchById(id);
    if (!match) throw new NotFoundException('Матч не знайдено');
    return match;
  }
}
