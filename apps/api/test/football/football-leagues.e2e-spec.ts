import { CLUB_SLUG_MAX_LENGTH } from '@football-portal/validation';
import { CompetitionType, MatchStatus, type Prisma } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { resetE2eData } from '../support/e2e-database';
import {
  createFootballSeason,
  seedFootballLeague,
  type E2eFootballLeague,
} from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const DAY_MS = 24 * 60 * 60 * 1000;

interface LeagueBody {
  slug: string;
  isInPlay: boolean;
}

/**
 * Публічні турніри з ознакою «у грі» (D48) — вкладки ліг стрічки новин (M1.6.1) — і клуб за slug — назва в чипі
 * фільтра `/news?club=`. «У грі» — те саме правило, що в підказках турнірів адмінки (`football-admin.e2e-spec.ts`).
 */
describe('Сайт: турніри «у грі» й клуб за slug', () => {
  let e2e: E2eApp;
  let premierLeague: E2eFootballLeague;

  function get(path: string) {
    return request(e2e.app.getHttpServer()).get(apiPath(path));
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    const now = Date.now();

    // PL: поточний сезон з матчем, що йде, і матчем попереду
    premierLeague = await seedFootballLeague(e2e.prisma);
    const clubIds: [string, string] = [
      premierLeague.homeClubId,
      premierLeague.awayClubId,
    ];
    const createCompetition = (data: Prisma.CompetitionCreateInput) =>
      e2e.prisma.competition.create({ data, select: { id: true } });
    const championsLeague = await createCompetition({
      slug: 'CL',
      name: 'UEFA Champions League',
      type: CompetitionType.CUP,
      sortOrder: 2,
    });
    const worldCup = await createCompetition({
      slug: 'WC',
      name: 'FIFA World Cup',
      type: CompetitionType.CUP,
      sortOrder: 3,
    });
    const faCup = await createCompetition({
      slug: 'FAC',
      name: 'FA Cup',
      type: CompetitionType.CUP,
      sortOrder: 4,
      isActive: false,
    });
    // Увімкнений, але ще не синкали — сезону немає
    await createCompetition({
      slug: 'BSA',
      name: 'Campeonato Brasileiro Série A',
      type: CompetitionType.LEAGUE,
      sortOrder: 5,
    });

    // Усе зіграно, але від кінця сезону минуло менше запасу (30 днів)
    await createFootballSeason(e2e.prisma, {
      competitionId: championsLeague.id,
      label: '2025/26',
      endDate: new Date(now - 10 * DAY_MS),
      isCurrent: true,
      clubIds,
      matchStatuses: [MatchStatus.FINISHED],
    });
    // Турнір скінчився давніше за запас, а сезон лишається поточним — як WC 2026 у жовтні
    await createFootballSeason(e2e.prisma, {
      competitionId: worldCup.id,
      label: '2026',
      endDate: new Date(now - 60 * DAY_MS),
      isCurrent: true,
      clubIds,
      matchStatuses: [MatchStatus.FINISHED],
    });
    // Матч попереду є, але турнір вимкнено
    await createFootballSeason(e2e.prisma, {
      competitionId: faCup.id,
      label: '2025/26',
      endDate: new Date(now + 100 * DAY_MS),
      isCurrent: true,
      clubIds,
      matchStatuses: [MatchStatus.SCHEDULED],
    });
  });
  afterAll(() => e2e.close());

  it('список — увімкнені турніри в порядку редакції; «у грі» — є матчі попереду або не минув запас', async () => {
    const response = await get('/football/leagues').expect(200);
    expectMatchesContract(response, 'get', '/football/leagues');
    expect(
      (response.body as LeagueBody[]).map(({ slug, isInPlay }) => [
        slug,
        isInPlay,
      ]),
    ).toEqual([
      ['PL', true],
      ['CL', true],
      ['WC', false],
      ['BSA', false],
    ]);
  });

  it('турнір за slug і в дашборді — та сама ознака; вимкнений — не «у грі», хоч матч попереду є', async () => {
    const expectedInPlay: [string, boolean][] = [
      ['PL', true],
      ['WC', false],
      ['FAC', false],
    ];
    for (const [slug, isInPlay] of expectedInPlay) {
      const league = await get(`/football/leagues/${slug}`).expect(200);
      expectMatchesContract(league, 'get', '/football/leagues/{slug}');
      expect(league.body).toMatchObject({ slug, isInPlay });

      const dashboard = await get(`/football/leagues/${slug}/dashboard`).expect(
        200,
      );
      expectMatchesContract(
        dashboard,
        'get',
        '/football/leagues/{slug}/dashboard',
      );
      expect(dashboard.body).toMatchObject({ league: { slug, isInPlay } });
    }
  });

  it('клуб за slug — поля клубу; невідомий — 404 CLUB_NOT_FOUND', async () => {
    const club = await get('/football/clubs/arsenal').expect(200);
    expectMatchesContract(club, 'get', '/football/clubs/{slug}');
    expect(club.body).toEqual({
      id: premierLeague.homeClubId,
      slug: 'arsenal',
      name: 'Arsenal FC',
      shortName: 'Arsenal',
      tla: 'ARS',
      crestUrl: 'https://e2e.test/crest.svg',
    });

    const missing = await get('/football/clubs/no-such-club').expect(404);
    expectMatchesContract(missing, 'get', '/football/clubs/{slug}');
    expect(missing.body).toMatchObject({ message: 'CLUB_NOT_FOUND' });
  });

  it.each([
    ['велика літера', 'Arsenal'],
    ['підкреслення', 'arsenal_fc'],
    [`довший за ${CLUB_SLUG_MAX_LENGTH}`, 'x'.repeat(CLUB_SLUG_MAX_LENGTH + 1)],
  ])('клуб: slug не того формату (%s) → 400', async (_case, slug) => {
    const response = await get(`/football/clubs/${slug}`).expect(400);
    expectMatchesContract(response, 'get', '/football/clubs/{slug}');
  });
});
