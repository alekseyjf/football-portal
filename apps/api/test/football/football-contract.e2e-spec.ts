import {
  DataProvider,
  Role,
  SyncScope,
  SyncStatus,
  SyncTrigger,
} from '@prisma/client';
import request from 'supertest';
import { createSyncStats } from '../../src/football/sync/football-sync-stats';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import {
  seedFootballLeague,
  type E2eFootballLeague,
} from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Відповіді футболу й журналу синку — за `packages/types/openapi.json` (D28). */
describe('Футбол: відповіді за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let league: E2eFootballLeague;

  function get(path: string, query: Record<string, string> = {}) {
    return request(e2e.app.getHttpServer()).get(apiPath(path)).query(query);
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    league = await seedFootballLeague(e2e.prisma);
  });
  afterAll(() => e2e.close());

  it('турніри, дашборд, таблиці, учасники, тури й матчі сезону', async () => {
    const pathTemplates = [
      ['/football/leagues', '/football/leagues'],
      [`/football/leagues/${league.slug}`, '/football/leagues/{slug}'],
      [
        `/football/leagues/${league.slug}/dashboard`,
        '/football/leagues/{slug}/dashboard',
      ],
      [
        `/football/leagues/${league.slug}/standings`,
        '/football/leagues/{slug}/standings',
      ],
      [
        `/football/leagues/${league.slug}/clubs`,
        '/football/leagues/{slug}/clubs',
      ],
      [
        `/football/leagues/${league.slug}/fixtures`,
        '/football/leagues/{slug}/fixtures',
      ],
      [
        `/football/leagues/${league.slug}/matches`,
        '/football/leagues/{slug}/matches',
      ],
    ];
    for (const [path, pathTemplate] of pathTemplates) {
      const response = await get(path).expect(200);
      expectMatchesContract(response, 'get', pathTemplate);
    }

    const dashboard = await get(
      `/football/leagues/${league.slug}/dashboard`,
    ).expect(200);
    expect(dashboard.body).toMatchObject({
      season: { label: '2025/26', startDate: '2025-08-15' },
      standingsTable: { stage: 'REGULAR_SEASON', groupName: null },
      standings: [{ position: 1 }, { position: 2 }],
    });
  });

  it('матчі за інтервалом і сторінка матчу', async () => {
    const now = Date.now();
    const range = await get('/football/matches', {
      from: new Date(now - 3 * DAY_MS).toISOString(),
      to: new Date(now + 3 * DAY_MS).toISOString(),
    }).expect(200);
    expectMatchesContract(range, 'get', '/football/matches');
    expect((range.body as { matches: unknown[] }).matches).toHaveLength(3);

    const match = await get(
      `/football/matches/${league.finishedMatchId}`,
    ).expect(200);
    expectMatchesContract(match, 'get', '/football/matches/{id}');
    expect(match.body).toMatchObject({
      status: 'FINISHED',
      winner: 'HOME',
      league: { slug: league.slug },
      season: { label: '2025/26' },
    });
  });

  it('помилки — за контрактом', async () => {
    // Запит створюємо в циклі: supertest слухає порт від створення до кінця свого запиту
    const cases: [string, Record<string, string>, number, string][] = [
      ['/football/leagues/XX', {}, 404, '/football/leagues/{slug}'],
      [
        `/football/leagues/${league.slug}/standings`,
        { season: '1999-00' },
        404,
        '/football/leagues/{slug}/standings',
      ],
      [
        `/football/leagues/${league.slug}/dashboard`,
        { season: 'last' },
        400,
        '/football/leagues/{slug}/dashboard',
      ],
      ['/football/matches/missing-match', {}, 404, '/football/matches/{id}'],
      [
        '/football/matches',
        { from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' },
        400,
        '/football/matches',
      ],
      [
        '/football/matches',
        { from: '2026-10-01', to: '2026-10-02' },
        400,
        '/football/matches',
      ],
    ];
    for (const [path, query, status, pathTemplate] of cases) {
      const response = await get(path, query).expect(status);
      expectMatchesContract(response, 'get', pathTemplate);
    }
  });

  it('live-touch: причина, чому синк не запущено', async () => {
    const touch = async (matchId: string) => {
      const response = await request(e2e.app.getHttpServer())
        .post(apiPath('/football/live-touch'))
        .send({ matchId })
        .expect(201);
      expectMatchesContract(response, 'post', '/football/live-touch');
      return response.body as unknown;
    };
    expect(await touch(league.finishedMatchId)).toEqual({
      accepted: false,
      skipped: 'not_live',
    });
    expect(await touch('missing-match')).toEqual({
      accepted: false,
      skipped: 'not_found',
    });
  });

  it('адмінка: синк без ключа провайдера → 503; журнал — зі статистикою й без неї', async () => {
    const admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    const startedAt = new Date();
    await e2e.prisma.syncRun.createMany({
      data: [
        {
          provider: DataProvider.FOOTBALL_DATA,
          scope: SyncScope.COMPETITION_FULL,
          targetRef: league.slug,
          trigger: SyncTrigger.ADMIN,
          status: SyncStatus.SUCCEEDED,
          startedAt,
          finishedAt: new Date(startedAt.getTime() + 30_000),
          stats: { ...createSyncStats(), apiCalls: 4, seasonLabel: '2025/26' },
        },
        // Рядок старого формату: лічильника `matchesUnknown` тоді ще не було
        {
          provider: DataProvider.FOOTBALL_DATA,
          scope: SyncScope.MATCHES_LIVE,
          targetRef: league.slug,
          trigger: SyncTrigger.CRON,
          status: SyncStatus.SUCCEEDED,
          startedAt,
          finishedAt: startedAt,
          stats: { apiCalls: 1, matchesUpdated: 2 },
        },
        {
          provider: DataProvider.FOOTBALL_DATA,
          scope: SyncScope.COMPETITION_FULL,
          targetRef: 'CL',
          trigger: SyncTrigger.CRON,
          startedAt,
        },
      ],
    });

    const sync = await admin
      .post(apiPath('/football/sync'))
      .send({})
      .expect(503);
    expectMatchesContract(sync, 'post', '/football/sync');

    const runs = await admin.get(apiPath('/football/sync-runs')).expect(200);
    expectMatchesContract(runs, 'get', '/football/sync-runs');
    expect(runs.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'RUNNING',
          finishedAt: null,
          stats: null,
        }),
        expect.objectContaining({
          scope: 'MATCHES_LIVE',
          stats: expect.objectContaining({
            apiCalls: 1,
            matchesUpdated: 2,
            matchesUnknown: 0,
          }) as unknown,
        }),
      ]),
    );
  });
});
