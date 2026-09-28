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
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { LiveTouchThrottle } from '../security/throttling/request-throttling';
import { LeagueMatchesQueryDto } from './dto/league-matches-query.dto';
import { LiveTouchDto } from './dto/live-touch.dto';
import { SeasonQueryDto } from './dto/season-query.dto';
import { SyncFootballDto } from './dto/sync-football.dto';
import { SyncRunsQueryDto } from './dto/sync-runs-query.dto';
import { FootballQueryService } from './query/football-query.service';
import { FootballLiveSyncService } from './sync/football-live-sync.service';
import { FootballSyncService } from './sync/football-sync.service';

@Controller('football')
export class FootballController {
  constructor(
    private readonly query: FootballQueryService,
    private readonly fullSync: FootballSyncService,
    private readonly liveSync: FootballLiveSyncService,
  ) {}

  @Get('leagues')
  listLeagues() {
    return this.query.getLeagues();
  }

  @Get('leagues/:slug/matches')
  leagueMatches(
    @Param('slug') slug: string,
    @Query() matchesQuery: LeagueMatchesQueryDto,
  ) {
    return this.query.getLeagueMatches(slug, matchesQuery);
  }

  @Get('leagues/:slug/standings')
  leagueStandings(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ) {
    return this.query.getLeagueStandings(slug, seasonQuery.season);
  }

  @Get('leagues/:slug/clubs')
  leagueClubs(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ) {
    return this.query.getLeagueClubs(slug, seasonQuery.season);
  }

  @Get('leagues/:slug/fixtures')
  leagueFixtures(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ) {
    return this.query.getLeagueFixtures(slug, seasonQuery.season);
  }

  /** Один запит: таблиця + тури (для сайдбару). */
  @Get('leagues/:slug/dashboard')
  leagueDashboard(
    @Param('slug') slug: string,
    @Query() seasonQuery: SeasonQueryDto,
  ) {
    return this.query.getLeagueDashboard(slug, seasonQuery.season);
  }

  @Get('leagues/:slug')
  leagueBySlug(@Param('slug') slug: string) {
    return this.query.getLeagueBySlug(slug);
  }

  @Get('matches/:id')
  matchById(@Param('id') id: string) {
    return this.query.getMatchById(id);
  }

  @Post('live-touch')
  @UseGuards(ThrottlerGuard)
  @LiveTouchThrottle()
  liveTouch(@Body() dto: LiveTouchDto) {
    return this.liveSync.requestLiveSyncForMatch(dto.matchId);
  }

  /** 202 одразу: синк — у фоні, хід і результат — `GET /football/sync-runs`. */
  @Post('sync')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async sync(@Body() dto: SyncFootballDto) {
    const competitions = await this.fullSync.requestFullSync(
      dto.competitionIds,
    );
    return { status: 'accepted' as const, competitions };
  }

  @Get('sync-runs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  syncRuns(@Query() syncRunsQuery: SyncRunsQueryDto) {
    return this.fullSync.getRecentRuns(syncRunsQuery.limit);
  }
}
