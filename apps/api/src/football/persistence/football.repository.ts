import { Injectable } from '@nestjs/common';
import { MatchStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { pendingMatchWhere } from '../football-competition-status';
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

/**
 * Турнір для `LeagueDto`: поля турніру й поточного сезону і все, з чого видно, чи він «у грі» (D48), — `isActive`
 * і скільки матчів сезону ще попереду (`pendingMatchWhere`).
 */
function leaguePublicSelect(pendingMatches: Prisma.MatchWhereInput) {
  return {
    ...COMPETITION_PUBLIC_SELECT,
    isActive: true,
    seasons: {
      ...COMPETITION_PUBLIC_SELECT.seasons,
      select: {
        ...SEASON_PUBLIC_SELECT,
        _count: { select: { matches: { where: pendingMatches } } },
      },
    },
  } satisfies Prisma.CompetitionSelect;
}

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

/** Турнір матчу у відповідях (`league`): деталь матчу, списки матчів за датою. */
const MATCH_COMPETITION_SELECT = {
  select: { id: true, slug: true, name: true, type: true, emblemUrl: true },
} satisfies Prisma.CompetitionDefaultArgs;

const MATCH_DETAIL_SELECT = {
  ...MATCH_ROW_SELECT,
  homeScoreHalfTime: true,
  awayScoreHalfTime: true,
  homePenalties: true,
  awayPenalties: true,
  winner: true,
  venueName: true,
  competition: MATCH_COMPETITION_SELECT,
  season: { select: { label: true, isCurrent: true } },
} satisfies Prisma.MatchSelect;

const MATCH_LIST_SELECT = {
  ...MATCH_ROW_SELECT,
  competition: MATCH_COMPETITION_SELECT,
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
export type LeagueRecord = Prisma.CompetitionGetPayload<{
  select: ReturnType<typeof leaguePublicSelect>;
}>;
export type ClubRecord = Prisma.ClubGetPayload<{
  select: typeof CLUB_PUBLIC_SELECT;
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
export type MatchListRecord = Prisma.MatchGetPayload<{
  select: typeof MATCH_LIST_SELECT;
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

  /**
   * Для перемикача ліг: лише `isActive`, за `sortOrder` (6.4, P5-15). `now` і `graceDays` — межа «матчу попереду»
   * правила «у грі» (D48).
   */
  findActiveLeagues(now: Date, graceDays: number): Promise<LeagueRecord[]> {
    return this.prisma.competition.findMany({
      where: { isActive: true },
      select: leaguePublicSelect(pendingMatchWhere(now, graceDays)),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Будь-який турнір за slug — і неактивний (архів, P5-15) — для `LeagueDto`, як `findActiveLeagues`. */
  findLeagueBySlug(
    slug: string,
    now: Date,
    graceDays: number,
  ): Promise<LeagueRecord | null> {
    return this.prisma.competition.findUnique({
      where: { slug },
      select: leaguePublicSelect(pendingMatchWhere(now, graceDays)),
    });
  }

  /** Будь-який турнір за slug — лише поточний сезон, без ознаки «у грі» (таблиці, тури, матчі сезону). */
  findCompetitionBySlug(slug: string): Promise<CompetitionRecord | null> {
    return this.prisma.competition.findUnique({
      where: { slug },
      select: COMPETITION_PUBLIC_SELECT,
    });
  }

  findClubBySlug(slug: string): Promise<ClubRecord | null> {
    return this.prisma.club.findUnique({
      where: { slug },
      select: CLUB_PUBLIC_SELECT,
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

  /**
   * Матчі за часом початку `[from, to)` у всіх турнірах (індекс `[kickoffAt]`). Без slug-ів —
   * лише активні турніри (як перемикач, P5-15); явні slug-и — будь-які, і вимкнені (архів).
   */
  findMatchesInRange(
    from: Date,
    to: Date,
    competitionSlugs: string[] | null,
    maxRows: number,
  ): Promise<MatchListRecord[]> {
    return this.prisma.match.findMany({
      where: {
        kickoffAt: { gte: from, lt: to },
        competition: competitionSlugs
          ? { slug: { in: competitionSlugs } }
          : { isActive: true },
      },
      select: MATCH_LIST_SELECT,
      orderBy: [{ kickoffAt: 'asc' }, { id: 'asc' }],
      take: maxRows,
    });
  }

  /**
   * Початок найближчого запланованого матчу активних турнірів — від `from` включно (індекс `[kickoffAt]`): «Найближчі
   * матчі» головної, коли сьогодні матчів немає (D55). `null` — попереду нічого.
   */
  async findNextKickoffAt(from: Date): Promise<Date | null> {
    const nextMatch = await this.prisma.match.findFirst({
      where: {
        kickoffAt: { gte: from },
        status: MatchStatus.SCHEDULED,
        competition: { isActive: true },
      },
      select: { kickoffAt: true },
      orderBy: [{ kickoffAt: 'asc' }, { id: 'asc' }],
    });
    return nextMatch?.kickoffAt ?? null;
  }

  findMatchById(id: string): Promise<MatchDetailRecord | null> {
    return this.prisma.match.findUnique({
      where: { id },
      select: MATCH_DETAIL_SELECT,
    });
  }
}
