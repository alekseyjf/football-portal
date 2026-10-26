import { CompetitionType, MatchStatus } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { resetE2eData } from '../support/e2e-database';
import {
  seedFootballLeague,
  type E2eFootballLeague,
} from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PATH_TEMPLATE = '/football/matches/next-kickoff';

/** Та сама миттєвість, записана з поясом +02:00 (як шле браузер у Києві взимку). */
function withKyivWinterOffset(instant: Date): string {
  return new Date(instant.getTime() + 2 * HOUR_MS)
    .toISOString()
    .replace('Z', '+02:00');
}

/**
 * Найближчий матч (D55) — «Найближчі матчі» головної, коли сьогодні матчів немає: перший запланований матч
 * увімкнених турнірів від миттєвості `from` включно; день і матчі цього дня сайт бере сам.
 */
describe('Найближчий матч: GET /football/matches/next-kickoff', () => {
  let e2e: E2eApp;
  let league: E2eFootballLeague;
  let scheduledAt: Date;
  let now: number;

  function nextKickoff(query: Record<string, string>) {
    return request(e2e.app.getHttpServer())
      .get(apiPath(PATH_TEMPLATE))
      .query(query);
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    now = Date.now();
    // PL: завершений (−2 доби), що йде (−30 хв), запланований (+2 доби)
    league = await seedFootballLeague(e2e.prisma, new Date(now));
    scheduledAt = new Date(now + 2 * DAY_MS);
    const clubs = {
      homeClubId: league.homeClubId,
      awayClubId: league.awayClubId,
    };
    const { id: seasonId } = await e2e.prisma.season.findFirstOrThrow({
      where: { competitionId: league.competitionId },
      select: { id: true },
    });
    // Раніше за запланований, але не «найближчі»: перенесений матч і матч вимкненого турніру
    await e2e.prisma.match.create({
      data: {
        competitionId: league.competitionId,
        seasonId,
        ...clubs,
        kickoffAt: new Date(now + DAY_MS),
        status: MatchStatus.POSTPONED,
      },
    });
    const archived = await e2e.prisma.competition.create({
      data: {
        slug: 'EC',
        name: 'European Championship',
        type: CompetitionType.CUP,
        isActive: false,
        seasons: {
          create: {
            label: '2028',
            startDate: new Date('2028-06-09'),
            endDate: new Date('2028-07-09'),
            isCurrent: true,
          },
        },
      },
      select: { id: true, seasons: { select: { id: true } } },
    });
    await e2e.prisma.match.create({
      data: {
        competitionId: archived.id,
        seasonId: archived.seasons[0].id,
        ...clubs,
        kickoffAt: new Date(now + HOUR_MS),
        status: MatchStatus.SCHEDULED,
      },
    });
  });
  afterAll(() => e2e.close());

  it('перший запланований матч увімкнених турнірів — без завершених, тих, що йдуть, перенесених і вимкнених турнірів', async () => {
    const response = await nextKickoff({
      from: new Date(now - 3 * DAY_MS).toISOString(),
    }).expect(200);
    expectMatchesContract(response, 'get', PATH_TEMPLATE);
    expect(response.body).toEqual({ kickoffAt: scheduledAt.toISOString() });
  });

  it('межа `from` — включно, пояс у запиті — будь-який; пізніше за останній — `kickoffAt: null` (міжсезоння)', async () => {
    for (const from of [
      scheduledAt.toISOString(),
      withKyivWinterOffset(scheduledAt),
    ]) {
      const response = await nextKickoff({ from }).expect(200);
      expect(response.body).toEqual({ kickoffAt: scheduledAt.toISOString() });
    }

    const after = await nextKickoff({
      from: new Date(scheduledAt.getTime() + 1).toISOString(),
    }).expect(200);
    expectMatchesContract(after, 'get', PATH_TEMPLATE);
    expect(after.body).toEqual({ kickoffAt: null });
  });

  it('`from` без поясу, не дата-час чи без параметра — 400', async () => {
    // Запит створюємо в циклі: supertest слухає порт від створення до кінця свого запиту
    const queries: Record<string, string>[] = [
      { from: '2026-10-27T00:00:00' },
      { from: '2026-10-27' },
      { from: 'tomorrow' },
      {},
    ];
    for (const query of queries) {
      const response = await nextKickoff(query).expect(400);
      expectMatchesContract(response, 'get', PATH_TEMPLATE);
    }
  });
});
