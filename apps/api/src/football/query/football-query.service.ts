import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClubDto, SeasonClubDto } from '../dto/club-response.dto';
import type { LeagueFixturesDto } from '../dto/fixtures-response.dto';
import type { LeagueDashboardDto } from '../dto/league-dashboard-response.dto';
import type { LeagueDto } from '../dto/league-response.dto';
import type {
  LeagueMatchesPageDto,
  MatchDetailDto,
  MatchesInRangeDto,
} from '../dto/match-response.dto';
import type { StandingTableDto } from '../dto/standing-response.dto';
import { COMPETITION_IN_PLAY_GRACE_DAYS } from '../football.constants';
import { groupMatchesIntoRounds } from '../football-matchday.util';
import {
  FootballRepository,
  type CompetitionRecord,
  type LeagueRecord,
  type SeasonRecord,
} from '../persistence/football.repository';
import {
  leagueSlugsFromParam,
  MATCH_RANGE_MAX_ROWS,
  parseMatchRange,
} from './football-match-range';
import {
  toPublicLeague,
  toPublicMatchDetail,
  toPublicMatchListItem,
  toPublicSeason,
  toPublicStandingTables,
} from './football-response';
import { seasonLabelFromParam } from './football-season-param';
import { pickPrimaryStandingTable } from './football-standings.util';

export type LeagueMatchesQuery = {
  season?: string;
  stage?: string;
  page: number;
  limit: number;
};

export type MatchesRangeQuery = {
  from: string;
  to: string;
  league?: string;
};

function startOfUtcDay(now: Date): Date {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

/**
 * Read-only сценарії футболу з БД. Усе — у межах сезону: `?season=2025-26` або поточний
 * (`isCurrent`, P5-16). Турнір без сезонів (ще не синкали) — порожні списки, не 404.
 */
@Injectable()
export class FootballQueryService {
  constructor(private readonly footballRepository: FootballRepository) {}

  async getLeagues(): Promise<LeagueDto[]> {
    const now = new Date();
    const leagues = await this.footballRepository.findActiveLeagues(
      now,
      COMPETITION_IN_PLAY_GRACE_DAYS,
    );
    return leagues.map((league) => toPublicLeague(league, now));
  }

  async getLeagueBySlug(slug: string): Promise<LeagueDto> {
    const now = new Date();
    return toPublicLeague(await this.leagueBySlugOrThrow(slug, now), now);
  }

  /** Клуб за slug — назва в чипі фільтра стрічки `/news?club=` (M1.6.1). */
  async getClubBySlug(slug: string): Promise<ClubDto> {
    const club = await this.footballRepository.findClubBySlug(slug);
    if (!club) throw new NotFoundException('CLUB_NOT_FOUND');
    return club;
  }

  async getLeagueClubs(
    slug: string,
    seasonParam?: string,
  ): Promise<SeasonClubDto[]> {
    const season = await this.resolveSeason(
      await this.competitionBySlugOrThrow(slug),
      seasonParam,
    );
    return season ? this.footballRepository.findSeasonClubs(season.id) : [];
  }

  async getLeagueStandings(
    slug: string,
    seasonParam?: string,
  ): Promise<StandingTableDto[]> {
    const season = await this.resolveSeason(
      await this.competitionBySlugOrThrow(slug),
      seasonParam,
    );
    if (!season) return [];
    return toPublicStandingTables(
      await this.footballRepository.findStandingRows(season.id),
    );
  }

  async getLeagueMatches(
    slug: string,
    matchesQuery: LeagueMatchesQuery,
  ): Promise<LeagueMatchesPageDto> {
    const season = await this.resolveSeason(
      await this.competitionBySlugOrThrow(slug),
      matchesQuery.season,
    );
    if (!season) return { matches: [], total: 0 };
    return this.footballRepository.findSeasonMatches(
      season.id,
      matchesQuery.stage,
      matchesQuery.page,
      matchesQuery.limit,
    );
  }

  async getLeagueFixtures(
    slug: string,
    seasonParam?: string,
  ): Promise<LeagueFixturesDto> {
    const season = await this.resolveSeason(
      await this.competitionBySlugOrThrow(slug),
      seasonParam,
    );
    return this.buildFixtures(season);
  }

  /**
   * Один round-trip для сайдбару (6.4): форма `{ league, standings, fixtures }` + `season`.
   * `standingsTable` — яка таблиця в `standings` (заголовок: таблиця ліги / ліга-фаза / група),
   * `null` — таблиці немає (турнір ще не синкали або провайдер її не дає: EC 2024, F4).
   */
  async getLeagueDashboard(
    slug: string,
    seasonParam?: string,
  ): Promise<LeagueDashboardDto> {
    const now = new Date();
    const league = await this.leagueBySlugOrThrow(slug, now);
    const season = await this.resolveSeason(league, seasonParam);
    const [standingRows, fixtures] = await Promise.all([
      season ? this.footballRepository.findStandingRows(season.id) : [],
      this.buildFixtures(season),
    ]);
    const primaryTable = pickPrimaryStandingTable(
      toPublicStandingTables(standingRows),
    );
    return {
      league: toPublicLeague(league, now),
      season: season ? toPublicSeason(season) : null,
      standingsTable: primaryTable
        ? { stage: primaryTable.stage, groupName: primaryTable.groupName }
        : null,
      standings: primaryTable?.rows ?? [],
      fixtures,
    };
  }

  async getMatchById(id: string): Promise<MatchDetailDto> {
    const match = await this.footballRepository.findMatchById(id);
    if (!match) throw new NotFoundException('MATCH_NOT_FOUND');
    return toPublicMatchDetail(match);
  }

  /**
   * Матчі за інтервалом у всіх турнірах — список дня, календар (🧭 п. 3 плану). Межі — миттєвості
   * від клієнта: «день» він рахує у своєму поясі. Без `league` — лише активні турніри.
   */
  async getMatchesInRange(
    rangeQuery: MatchesRangeQuery,
  ): Promise<MatchesInRangeDto> {
    const range = parseMatchRange(rangeQuery.from, rangeQuery.to);
    if (!range.isValid) throw new BadRequestException(range.errorCode);
    const matches = await this.footballRepository.findMatchesInRange(
      range.from,
      range.to,
      leagueSlugsFromParam(rangeQuery.league),
      MATCH_RANGE_MAX_ROWS,
    );
    return { matches: matches.map(toPublicMatchListItem) };
  }

  private async buildFixtures(
    season: SeasonRecord | null,
  ): Promise<LeagueFixturesDto> {
    if (!season) return { upcoming: [], past: [] };
    const dayStart = startOfUtcDay(new Date());
    const [upcomingMatches, pastMatches] = await Promise.all([
      this.footballRepository.findUpcomingMatches(season.id, dayStart),
      this.footballRepository.findPastMatches(season.id, dayStart),
    ]);
    return {
      upcoming: groupMatchesIntoRounds(upcomingMatches, 'asc'),
      past: groupMatchesIntoRounds(pastMatches, 'desc'),
    };
  }

  private async competitionBySlugOrThrow(
    slug: string,
  ): Promise<CompetitionRecord> {
    const competition =
      await this.footballRepository.findCompetitionBySlug(slug);
    if (!competition) throw new NotFoundException('LEAGUE_NOT_FOUND');
    return competition;
  }

  private async leagueBySlugOrThrow(
    slug: string,
    now: Date,
  ): Promise<LeagueRecord> {
    const league = await this.footballRepository.findLeagueBySlug(
      slug,
      now,
      COMPETITION_IN_PLAY_GRACE_DAYS,
    );
    if (!league) throw new NotFoundException('LEAGUE_NOT_FOUND');
    return league;
  }

  /** `?season=` → цей сезон або 404; без нього — поточний (може не бути, якщо ще не синкали). */
  private async resolveSeason(
    competition: CompetitionRecord,
    seasonParam?: string,
  ): Promise<SeasonRecord | null> {
    if (!seasonParam) return competition.seasons[0] ?? null;
    const season = await this.footballRepository.findSeasonByLabel(
      competition.id,
      seasonLabelFromParam(seasonParam),
    );
    if (!season) throw new NotFoundException('SEASON_NOT_FOUND');
    return season;
  }
}
