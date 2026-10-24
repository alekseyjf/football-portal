import {
  CompetitionType,
  MatchStatus,
  MatchWinner,
  type PrismaClient,
} from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface E2eFootballLeague {
  competitionId: string;
  slug: string;
  homeClubId: string;
  awayClubId: string;
  finishedMatchId: string;
  scheduledMatchId: string;
}

/**
 * Турнір, як після синку: країна, ліга з поточним сезоном, два клуби, матчі (завершений, що йде,
 * запланований) і таблиця. Записи — напряму в БД: синк у e2e без ключа провайдера не працює.
 * Усі nullable-поля заповнені — щоб контракт перевіряв і їхні формати.
 */
export async function seedFootballLeague(
  prisma: PrismaClient,
  now = new Date(),
): Promise<E2eFootballLeague> {
  const area = await prisma.area.create({
    data: { code: 'ENG', name: 'England', flagUrl: 'https://e2e.test/eng.svg' },
  });
  const competition = await prisma.competition.create({
    data: {
      slug: 'PL',
      name: 'Premier League',
      type: CompetitionType.LEAGUE,
      areaId: area.id,
      emblemUrl: 'https://e2e.test/pl.svg',
      sortOrder: 1,
    },
  });
  const season = await prisma.season.create({
    data: {
      competitionId: competition.id,
      label: '2025/26',
      startDate: new Date('2025-08-15'),
      endDate: new Date('2026-05-24'),
      isCurrent: true,
      currentMatchday: 9,
    },
  });
  const [homeClub, awayClub] = await Promise.all(
    [
      { slug: 'arsenal', name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS' },
      { slug: 'chelsea', name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE' },
    ].map((club) =>
      prisma.club.create({
        data: {
          ...club,
          areaId: area.id,
          crestUrl: 'https://e2e.test/crest.svg',
        },
      }),
    ),
  );
  await prisma.seasonClub.createMany({
    data: [homeClub, awayClub].map((club) => ({
      seasonId: season.id,
      clubId: club.id,
    })),
  });

  const matchBase = {
    competitionId: competition.id,
    seasonId: season.id,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    venueName: 'Emirates Stadium',
  };
  const finishedMatch = await prisma.match.create({
    data: {
      ...matchBase,
      matchday: 8,
      kickoffAt: new Date(now.getTime() - 2 * DAY_MS),
      status: MatchStatus.FINISHED,
      homeScore: 2,
      awayScore: 1,
      homeScoreHalfTime: 1,
      awayScoreHalfTime: 0,
      winner: MatchWinner.HOME,
    },
  });
  await prisma.match.create({
    data: {
      ...matchBase,
      matchday: 9,
      kickoffAt: new Date(now.getTime() - HOUR_MS / 2),
      status: MatchStatus.LIVE,
      minute: 31,
      homeScore: 0,
      awayScore: 0,
    },
  });
  const scheduledMatch = await prisma.match.create({
    data: {
      ...matchBase,
      matchday: 10,
      kickoffAt: new Date(now.getTime() + 2 * DAY_MS),
    },
  });

  await prisma.standing.createMany({
    data: [homeClub, awayClub].map((club, index) => ({
      seasonId: season.id,
      clubId: club.id,
      position: index + 1,
      played: 8,
      won: 6 - index,
      drawn: 1,
      lost: 1 + index,
      points: 19 - 3 * index,
      goalsFor: 15,
      goalsAgainst: 7 + index,
      goalDiff: 8 - index,
      form: 'W,W,D,L,W',
    })),
  });

  return {
    competitionId: competition.id,
    slug: competition.slug,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    finishedMatchId: finishedMatch.id,
    scheduledMatchId: scheduledMatch.id,
  };
}

export interface FootballSeasonSeed {
  competitionId: string;
  label: string;
  endDate: Date;
  isCurrent: boolean;
  /** Учасники сезону; кожен матч — між першими двома */
  clubIds: [string, string, ...string[]];
  matchStatuses: MatchStatus[];
  /** Матчі — по одному на день до цієї дати; без неї — до `endDate` */
  lastKickoffAt?: Date;
}

/** Сезон з учасниками й матчами заданих статусів — записом у БД, як після синку. */
export async function createFootballSeason(
  prisma: PrismaClient,
  seed: FootballSeasonSeed,
): Promise<void> {
  const season = await prisma.season.create({
    data: {
      competitionId: seed.competitionId,
      label: seed.label,
      startDate: new Date(seed.endDate.getTime() - 90 * DAY_MS),
      endDate: seed.endDate,
      isCurrent: seed.isCurrent,
    },
  });
  await prisma.seasonClub.createMany({
    data: seed.clubIds.map((clubId) => ({ seasonId: season.id, clubId })),
  });
  await prisma.match.createMany({
    data: seed.matchStatuses.map((status, index) => ({
      competitionId: seed.competitionId,
      seasonId: season.id,
      homeClubId: seed.clubIds[0],
      awayClubId: seed.clubIds[1],
      kickoffAt: new Date(
        (seed.lastKickoffAt ?? seed.endDate).getTime() - index * DAY_MS,
      ),
      status,
    })),
  });
}
