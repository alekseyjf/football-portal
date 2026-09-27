import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IN_PLAY_MATCH_STATUSES } from '../football-match-status';

const CLUB_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  tla: true,
  crestUrl: true,
} satisfies Prisma.ClubSelect;

const AREA_PUBLIC_SELECT = {
  code: true,
  name: true,
  flagUrl: true,
} satisfies Prisma.AreaSelect;

const SEASON_PUBLIC_SELECT = {
  id: true,
  label: true,
  isCurrent: true,
  currentMatchday: true,
  startDate: true,
  endDate: true,
} satisfies Prisma.SeasonSelect;

const COMPETITION_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  emblemUrl: true,
  area: { select: AREA_PUBLIC_SELECT },
  seasons: {
    where: { isCurrent: true },
    select: SEASON_PUBLIC_SELECT,
    take: 1,
  },
} satisfies Prisma.CompetitionSelect;

const MATCH_ROW_SELECT = {
  id: true,
  kickoffAt: true,
  status: true,
  minute: true,
  matchday: true,
  stage: true,
  groupName: true,
  homeScore: true,
  awayScore: true,
  homeClub: { select: CLUB_PUBLIC_SELECT },
  awayClub: { select: CLUB_PUBLIC_SELECT },
} satisfies Prisma.MatchSelect;

const MATCH_DETAIL_SELECT = {
  ...MATCH_ROW_SELECT,
  homeScoreHalfTime: true,
  awayScoreHalfTime: true,
  homePenalties: true,
  awayPenalties: true,
  winner: true,
  venueName: true,
  competition: {
    select: { id: true, slug: true, name: true, type: true, emblemUrl: true },
  },
  season: { select: { label: true, isCurrent: true } },
} satisfies Prisma.MatchSelect;

const STANDING_ROW_SELECT = {
  stage: true,
  groupName: true,
  type: true,
  position: true,
  played: true,
  won: true,
  drawn: true,
  lost: true,
  points: true,
  goalsFor: true,
  goalsAgainst: true,
  goalDiff: true,
  form: true,
  club: { select: CLUB_PUBLIC_SELECT },
} satisfies Prisma.StandingSelect;

export type CompetitionRecord = Prisma.CompetitionGetPayload<{
  select: typeof COMPETITION_PUBLIC_SELECT;
}>;
export type SeasonRecord = Prisma.SeasonGetPayload<{
  select: typeof SEASON_PUBLIC_SELECT;
}>;
export type MatchRowRecord = Prisma.MatchGetPayload<{
  select: typeof MATCH_ROW_SELECT;
}>;
export type MatchDetailRecord = Prisma.MatchGetPayload<{
  select: typeof MATCH_DETAIL_SELECT;
}>;
export type StandingRowRecord = Prisma.StandingGetPayload<{
  select: typeof STANDING_ROW_SELECT;
}>;

/** Скільки матчів у «найближчих» / «минулих» турах сайдбару. */
const FIXTURES_TAKE = 80;

/** Публічні читання футболу — лише з БД, завжди в межах сезону (P5-16). */
@Injectable()
export class FootballRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Для перемикача ліг: лише `isActive`, за `sortOrder` (6.4, P5-15). */
  findActiveCompetitions(): Promise<CompetitionRecord[]> {
    return this.prisma.competition.findMany({
      where: { isActive: true },
      select: COMPETITION_PUBLIC_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Будь-який турнір за slug — і неактивний (архів, P5-15). */
  findCompetitionBySlug(slug: string): Promise<CompetitionRecord | null> {
    return this.prisma.competition.findUnique({
      where: { slug },
      select: COMPETITION_PUBLIC_SELECT,
    });
  }

  findSeasonByLabel(
    competitionId: string,
    label: string,
  ): Promise<SeasonRecord | null> {
    return this.prisma.season.findUnique({
      where: { competitionId_label: { competitionId, label } },
      select: SEASON_PUBLIC_SELECT,
    });
  }

  /** Усі таблиці сезону, згруповані порядком `(stage, groupName, type, position)`. */
  findStandingRows(seasonId: string): Promise<StandingRowRecord[]> {
    return this.prisma.standing.findMany({
      where: { seasonId },
      select: STANDING_ROW_SELECT,
      orderBy: [
        { stage: 'asc' },
        { groupName: 'asc' },
        { type: 'asc' },
        { position: 'asc' },
      ],
    });
  }

  async findSeasonClubs(seasonId: string) {
    const participants = await this.prisma.seasonClub.findMany({
      where: { seasonId },
      select: { club: { select: { ...CLUB_PUBLIC_SELECT, kind: true } } },
      orderBy: { club: { name: 'asc' } },
    });
    return participants.map((participant) => participant.club);
  }

  async findSeasonMatches(
    seasonId: string,
    stage: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ matches: MatchRowRecord[]; total: number }> {
    const where: Prisma.MatchWhereInput = { seasonId, stage };
    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        select: MATCH_ROW_SELECT,
        orderBy: [{ kickoffAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.match.count({ where }),
    ]);
    return { matches, total };
  }

  /** Від початку UTC-дня або ті, що йдуть зараз (`LIVE` / `PAUSED`) — для сайдбару. */
  findUpcomingMatches(
    seasonId: string,
    dayStart: Date,
  ): Promise<MatchRowRecord[]> {
    return this.prisma.match.findMany({
      where: {
        seasonId,
        OR: [
          { kickoffAt: { gte: dayStart } },
          { status: { in: [...IN_PLAY_MATCH_STATUSES] } },
        ],
      },
      select: MATCH_ROW_SELECT,
      orderBy: [{ matchday: 'asc' }, { kickoffAt: 'asc' }, { id: 'asc' }],
      take: FIXTURES_TAKE,
    });
  }

  /** До початку UTC-дня, крім тих, що йдуть зараз. */
  findPastMatches(seasonId: string, dayStart: Date): Promise<MatchRowRecord[]> {
    return this.prisma.match.findMany({
      where: {
        seasonId,
        kickoffAt: { lt: dayStart },
        status: { notIn: [...IN_PLAY_MATCH_STATUSES] },
      },
      select: MATCH_ROW_SELECT,
      orderBy: [{ matchday: 'desc' }, { kickoffAt: 'desc' }, { id: 'asc' }],
      take: FIXTURES_TAKE,
    });
  }

  findMatchById(id: string): Promise<MatchDetailRecord | null> {
    return this.prisma.match.findUnique({
      where: { id },
      select: MATCH_DETAIL_SELECT,
    });
  }
}
