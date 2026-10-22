import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { clubSearchWhere } from '../football-club-search';
import { pendingMatchWhere } from '../football-competition-status';
import { CLUB_REF_SELECT, COMPETITION_REF_SELECT } from '../football-refs';

/** Турнір у виборі: поля чипа + тип (групи «Ліги» / «Кубки») і чи ввімкнений. */
const ADMIN_COMPETITION_SELECT = {
  ...COMPETITION_REF_SELECT,
  type: true,
  isActive: true,
} satisfies Prisma.CompetitionSelect;

/** Клуб-кандидат пошуку: поля чипа + поля, за якими ранжуємо. */
const CLUB_SEARCH_SELECT = {
  ...CLUB_REF_SELECT,
  shortName: true,
  tla: true,
} satisfies Prisma.ClubSelect;

/**
 * Участь клубу в сезоні: турнір-чип і все, з чого видно, чи турнір «у грі» (D48); лічильник — матчі,
 * що ще попереду (`pendingMatchWhere`).
 */
function clubParticipationSelect(pendingMatches: Prisma.MatchWhereInput) {
  return {
    clubId: true,
    season: {
      select: {
        isCurrent: true,
        endDate: true,
        competition: { select: { ...COMPETITION_REF_SELECT, isActive: true } },
        _count: { select: { matches: { where: pendingMatches } } },
      },
    },
  } satisfies Prisma.SeasonClubSelect;
}

export type AdminCompetitionRow = Prisma.CompetitionGetPayload<{
  select: typeof ADMIN_COMPETITION_SELECT;
}>;
export type ClubSearchRow = Prisma.ClubGetPayload<{
  select: typeof CLUB_SEARCH_SELECT;
}>;
export type ClubParticipationRow = Prisma.SeasonClubGetPayload<{
  select: ReturnType<typeof clubParticipationSelect>;
}>;

/** Читання футболу для адмінки — вибір турнірів і клубів у формі новини (D48). Публічні — `FootballRepository`. */
@Injectable()
export class FootballAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Усі турніри, і вимкнені, — у порядку редакції. */
  findAllCompetitions(): Promise<AdminCompetitionRow[]> {
    return this.prisma.competition.findMany({
      select: ADMIN_COMPETITION_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Клуби, що підходять під запит (`clubSearchWhere`), — до `maxRows`, за абеткою назви. */
  findClubsBySearch(search: string, maxRows: number): Promise<ClubSearchRow[]> {
    return this.prisma.club.findMany({
      where: clubSearchWhere(search),
      select: CLUB_SEARCH_SELECT,
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
      take: maxRows,
    });
  }

  /**
   * Участь клубів у поточних сезонах турнірів — одним запитом на всі клуби, у порядку турнірів (`sortOrder`).
   * Архівні сезони не читаємо: їх щороку більшає, а «у грі» буває лише поточний (`isCompetitionInPlay`).
   * `now` і `graceDays` — межа «матчу попереду», як у правилі.
   */
  findCurrentSeasonParticipations(
    clubIds: string[],
    now: Date,
    graceDays: number,
  ): Promise<ClubParticipationRow[]> {
    return this.prisma.seasonClub.findMany({
      where: { clubId: { in: clubIds }, season: { isCurrent: true } },
      select: clubParticipationSelect(pendingMatchWhere(now, graceDays)),
      orderBy: [
        { season: { competition: { sortOrder: 'asc' } } },
        { season: { competition: { name: 'asc' } } },
      ],
    });
  }
}
