import { Injectable } from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const clubPublicSelect = {
  id: true,
  name: true,
  slug: true,
  shortName: true,
  logo: true,
} as const;

const leaguePublicSelect = {
  id: true,
  name: true,
  slug: true,
  country: true,
  season: true,
  logoUrl: true,
} as const;

const matchListSelect = {
  id: true,
  date: true,
  status: true,
  minute: true,
  matchday: true,
  homeScore: true,
  awayScore: true,
  homeClub: { select: clubPublicSelect },
  awayClub: { select: clubPublicSelect },
} as const;

@Injectable()
export class FootballRepository {
  constructor(private prisma: PrismaService) {}

  async upsertLeague(data: {
    externalId: number;
    name: string;
    slug: string;
    country: string;
    season: string;
    logoUrl: string | null;
  }) {
    return this.prisma.league.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        name: data.name,
        // slug не змінюємо при синку — щоб ручні правки (напр. PL) не перезаписувались
        country: data.country,
        season: data.season,
        logoUrl: data.logoUrl,
      },
      select: { id: true, externalId: true, slug: true },
    });
  }

  async upsertClub(data: {
    externalId: number;
    name: string;
    slug: string;
    shortName: string | null;
    logo: string | null;
    founded: number | null;
    venue: string | null;
    leagueId: string;
  }) {
    return this.prisma.club.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        name: data.name,
        slug: data.slug,
        shortName: data.shortName,
        logo: data.logo,
        founded: data.founded,
        venue: data.venue,
        leagueId: data.leagueId,
      },
      select: { id: true, externalId: true },
    });
  }

  async upsertMatch(data: {
    externalId: number;
    leagueId: string;
    homeClubId: string;
    awayClubId: string;
    date: Date;
    status: MatchStatus;
    minute: number | null;
    matchday: number | null;
    homeScore: number | null;
    awayScore: number | null;
  }) {
    return this.prisma.match.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        leagueId: data.leagueId,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        date: data.date,
        status: data.status,
        minute: data.minute,
        matchday: data.matchday,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
      },
      select: { id: true },
    });
  }

  async findLeagues() {
    return this.prisma.league.findMany({
      select: leaguePublicSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findLeagueBySlug(slug: string) {
    return this.prisma.league.findUnique({
      where: { slug },
      select: leaguePublicSelect,
    });
  }

  async findMatchesByLeague(leagueId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where: { leagueId },
        select: matchListSelect,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.match.count({ where: { leagueId } }),
    ]);
    return { matches, total };
  }

  async findMatchById(id: string) {
    return this.prisma.match.findFirst({
      where: { id },
      select: {
        ...matchListSelect,
        league: { select: leaguePublicSelect },
      },
    });
  }

  async findMatchLiveContext(id: string) {
    return this.prisma.match.findFirst({
      where: { id },
      select: {
        status: true,
        league: { select: { externalId: true } },
      },
    });
  }

  /** Майбутні матчі (від початку UTC-дня або LIVE) — для сайдбару. */
  async findUpcomingMatchesByLeague(leagueId: string, take = 80) {
    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);
    return this.prisma.match.findMany({
      where: {
        leagueId,
        OR: [{ date: { gte: startUtc } }, { status: 'LIVE' }],
      },
      select: matchListSelect,
      orderBy: [{ matchday: 'asc' }, { date: 'asc' }],
      take,
    });
  }

  /** Минулі матчі (до початку UTC-дня, без LIVE) — для сайдбару. */
  async findPastMatchesByLeague(leagueId: string, take = 80) {
    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);
    return this.prisma.match.findMany({
      where: {
        leagueId,
        AND: [{ date: { lt: startUtc } }, { status: { not: 'LIVE' } }],
      },
      select: matchListSelect,
      orderBy: [{ matchday: 'desc' }, { date: 'desc' }],
      take,
    });
  }

  async findStandingsByLeague(leagueId: string) {
    return this.prisma.leagueTable.findMany({
      where: { leagueId },
      select: {
        position: true,
        played: true,
        won: true,
        drawn: true,
        lost: true,
        points: true,
        goalsFor: true,
        goalsAgainst: true,
        goalDiff: true,
        club: { select: clubPublicSelect },
      },
      orderBy: { position: 'asc' },
    });
  }

  async replaceLeagueStandings(
    leagueId: string,
    rows: Prisma.LeagueTableCreateManyInput[],
  ) {
    await this.prisma.$transaction([
      this.prisma.leagueTable.deleteMany({ where: { leagueId } }),
      this.prisma.leagueTable.createMany({ data: rows }),
    ]);
  }
}
