import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { readConfiguredCompetitionIds } from './football.constants';
import { LiveTouchDto } from './dto/live-touch.dto';
import { SyncFootballDto } from './dto/sync-football.dto';
import { FootballQueryService } from './query/football-query.service';
import { FootballSyncService } from './sync/football-sync.service';

@Controller('football')
export class FootballController {
  constructor(
    private readonly query: FootballQueryService,
    private readonly syncService: FootballSyncService,
  ) {}

  @Get('leagues')
  listLeagues() {
    return this.query.getLeagues();
  }

  @Get('leagues/:slug/matches')
  leagueMatches(
    @Param('slug') slug: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.query.getLeagueMatches(slug, +page, +limit);
  }

  @Get('leagues/:slug/standings')
  leagueStandings(@Param('slug') slug: string) {
    return this.query.getLeagueStandings(slug);
  }

  @Get('leagues/:slug/fixtures')
  leagueFixtures(@Param('slug') slug: string) {
    return this.query.getLeagueFixtures(slug);
  }

  /** Один запит: таблиця + тури (для сайдбару). */
  @Get('leagues/:slug/dashboard')
  leagueDashboard(@Param('slug') slug: string) {
    return this.query.getLeagueDashboard(slug);
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
  liveTouch(@Body() dto: LiveTouchDto) {
    return this.syncService.requestLiveSyncForMatch(dto.matchId);
  }

  /**
   * Фоновий повний синк (без очікування завершення — зручно для адмінки / проксі).
   */
  @Post('sync')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  sync(@Body() dto: SyncFootballDto) {
    const refs = dto.competitionIds?.length
      ? dto.competitionIds
      : readConfiguredCompetitionIds();
    if (!refs.length) {
      throw new BadRequestException('Немає competition id для синку');
    }
    this.syncService.enqueueFullSync(refs);
    return {
      status: 'accepted' as const,
      message:
        'Синхронізацію запущено у фоні. Прогрес дивіться в логах API; дані з’являться в БД після завершення.',
      competitions: refs,
    };
  }
}
