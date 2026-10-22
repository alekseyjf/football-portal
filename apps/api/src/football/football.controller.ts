import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminOnly } from '../auth/guards/access.decorators';
import { LiveTouchThrottle } from '../security/throttling/request-throttling';
import { AdminClubSearchQueryDto } from './dto/admin-club-search-query.dto';
import {
  AdminClubSearchResultDto,
  SeasonClubDto,
} from './dto/club-response.dto';
import { LeagueFixturesDto } from './dto/fixtures-response.dto';
import {
  FootballSyncAcceptedDto,
  SyncRunDto,
} from './dto/football-sync-response.dto';
import { LeagueDashboardDto } from './dto/league-dashboard-response.dto';
import { LeagueMatchesQueryDto } from './dto/league-matches-query.dto';
import { AdminLeagueDto, LeagueDto } from './dto/league-response.dto';
import { LiveTouchResultDto } from './dto/live-touch-response.dto';
import { LiveTouchDto } from './dto/live-touch.dto';
import {
  LeagueMatchesPageDto,
  MatchDetailDto,
  MatchesInRangeDto,
} from './dto/match-response.dto';
import { MatchesRangeQueryDto } from './dto/matches-range-query.dto';
import { SeasonQueryDto } from './dto/season-query.dto';
import { StandingTableDto } from './dto/standing-response.dto';
import { SyncFootballDto } from './dto/sync-football.dto';
import { SyncRunsQueryDto } from './dto/sync-runs-query.dto';
import { FootballAdminQueryService } from './query/football-admin-query.service';
import { FootballQueryService } from './query/football-query.service';
import { FootballLiveSyncService } from './sync/football-live-sync.service';
import { FootballSyncService } from './sync/football-sync.service';

@ApiTags('football')
@Controller('football')
export class FootballController {
  constructor(
    private readonly query: FootballQueryService,
    private readonly adminQuery: FootballAdminQueryService,
    private readonly fullSync: FootballSyncService,
    private readonly liveSync: FootballLiveSyncService,
  ) {}

  /** Активні турніри (перемикач ліг), у порядку редакції. */
  @Get('leagues')
  listLeagues(): Promise<LeagueDto[]> {
    return this.query.getLeagues();
  }

  /** Усі турніри для вибору в новині — і вимкнені (новини про ЧС / Євро після турніру), у порядку редакції. */
  @Get('leagues/admin/all')
  @AdminOnly()
  listAdminLeagues(): Promise<AdminLeagueDto[]> {
    return this.adminQuery.getAdminLeagues();
  }

  /**
   * Матчі сезону сторінками, новіші першими.
   * @throws {404} LEAGUE_NOT_FOUND, SEASON_NOT_FOUND
   */
  @Get('leagues/:slug/matches')
  leagueMatches(
    @Param('slug') slug: string,
    @Query() matchesQuery: LeagueMatchesQueryDto,
  ): Promise<LeagueMatchesPageDto> {
    return this.query.getLeagueMatches(slug, matchesQuery);
  }

  /**
   * Усі таблиці сезону (стадії, групи, загальна / вдома / в гостях).
   * @throws {404} LEAGUE_NOT_FOUND, SEASON_NOT_FOUND
   */
  @Get('leagues/:slug/standings')
  leagueStandings(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ): Promise<StandingTableDto[]> {
    return this.query.getLeagueStandings(slug, seasonQuery.season);
  }

  /**
   * Учасники сезону.
   * @throws {404} LEAGUE_NOT_FOUND, SEASON_NOT_FOUND
   */
  @Get('leagues/:slug/clubs')
  leagueClubs(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ): Promise<SeasonClubDto[]> {
    return this.query.getLeagueClubs(slug, seasonQuery.season);
  }

  /**
   * Тури сезону: найближчі й минулі.
   * @throws {404} LEAGUE_NOT_FOUND, SEASON_NOT_FOUND
   */
  @Get('leagues/:slug/fixtures')
  leagueFixtures(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ): Promise<LeagueFixturesDto> {
    return this.query.getLeagueFixtures(slug, seasonQuery.season);
  }

  /**
   * Сайдбар одним запитом: головна таблиця й тури.
   * @throws {404} LEAGUE_NOT_FOUND, SEASON_NOT_FOUND
   */
  @Get('leagues/:slug/dashboard')
  leagueDashboard(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ): Promise<LeagueDashboardDto> {
    return this.query.getLeagueDashboard(slug, seasonQuery.season);
  }

  /**
   * Турнір за slug — і неактивний (архів).
   * @throws {404} LEAGUE_NOT_FOUND
   */
  @Get('leagues/:slug')
  leagueBySlug(@Param('slug') slug: string): Promise<LeagueDto> {
    return this.query.getLeagueBySlug(slug);
  }

  /**
   * Матчі за часом початку `[from, to)` у всіх турнірах (до 1000).
   * @throws {400} Невалідні параметри; MATCH_RANGE_INVALID — `to` не пізніше `from`; MATCH_RANGE_TOO_LONG — довше 32 діб
   */
  @Get('matches')
  matchesInRange(
    @Query() rangeQuery: MatchesRangeQueryDto,
  ): Promise<MatchesInRangeDto> {
    return this.query.getMatchesInRange(rangeQuery);
  }

  /**
   * Матч з турніром і сезоном.
   * @throws {404} MATCH_NOT_FOUND
   */
  @Get('matches/:id')
  matchById(@Param('id') id: string): Promise<MatchDetailDto> {
    return this.query.getMatchById(id);
  }

  /**
   * Пошук клубів для форми новини — серед клубів із синку: частина назви, короткої назви, коду чи адреси, без урахування регістру.
   * @remarks До 20 клубів: спершу ті, у кого з запиту починається будь-яке з цих полів, далі — за абеткою. Назви — як
   * у провайдера, латиницею. У клубу — турніри поточного сезону, які зараз «у грі»: з них форма підказує турніри новини.
   */
  @Get('clubs/admin/search')
  @AdminOnly()
  searchAdminClubs(
    @Query() searchQuery: AdminClubSearchQueryDto,
  ): Promise<AdminClubSearchResultDto[]> {
    return this.adminQuery.searchClubs(searchQuery.search);
  }

  /**
   * Сторінка матчу відкрита: оновити LIVE-дані його турніру, якщо матч у LIVE-вікні.
   * @remarks Синк — у фоні, не частіше разу на хвилину на турнір; нові дані — наступним запитом матчу.
   * @throws {429} TOO_MANY_REQUESTS — понад 10 запитів за хвилину з IP
   */
  @Post('live-touch')
  @UseGuards(ThrottlerGuard)
  @LiveTouchThrottle()
  liveTouch(@Body() dto: LiveTouchDto): Promise<LiveTouchResultDto> {
    return this.liveSync.requestLiveSyncForMatch(dto.matchId);
  }

  /**
   * Повний синк турнірів з провайдера — у фоні; хід і результат — `GET /football/sync-runs`.
   * @throws {400} Невалідне тіло; UNKNOWN_COMPETITION — турніру з таким slug немає
   * @throws {503} FOOTBALL_PROVIDER_NOT_CONFIGURED — немає ключа провайдера
   */
  @Post('sync')
  @HttpCode(202)
  @AdminOnly()
  async sync(@Body() dto: SyncFootballDto): Promise<FootballSyncAcceptedDto> {
    const competitions = await this.fullSync.requestFullSync(
      dto.competitionIds,
    );
    return { status: 'accepted', competitions };
  }

  /** Журнал синків, новіші першими. */
  @Get('sync-runs')
  @AdminOnly()
  syncRuns(@Query() syncRunsQuery: SyncRunsQueryDto): Promise<SyncRunDto[]> {
    return this.fullSync.getRecentRuns(syncRunsQuery.limit);
  }
}
