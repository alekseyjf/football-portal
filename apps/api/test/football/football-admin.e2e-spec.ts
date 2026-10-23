import {
  ADMIN_CLUBS_SEARCH_MAX_LENGTH,
  ADMIN_CLUBS_SEARCH_MIN_LENGTH,
  ADMIN_CLUBS_SEARCH_RESULTS_MAX,
} from '@football-portal/validation';
import {
  ClubKind,
  CompetitionType,
  MatchStatus,
  Role,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Клубів «Alpha City NN» — більше, ніж повертає пошук. */
const CITY_CLUBS_COUNT = ADMIN_CLUBS_SEARCH_RESULTS_MAX + 2;

interface CompetitionRef {
  id: string;
  slug: string;
  name: string;
}

interface AdminLeague extends CompetitionRef {
  type: string;
  isActive: boolean;
}

interface ClubSearchResult {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tla: string | null;
  crestUrl: string | null;
  competitions: CompetitionRef[];
}

interface SeasonSeed {
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
async function createSeason(
  prisma: PrismaClient,
  seed: SeasonSeed,
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

function cityClubName(index: number): string {
  return `Alpha City ${String(index + 1).padStart(2, '0')}`;
}

/**
 * Турніри й клуби для форми новини (M1.4.8.2, D48): усі турніри, і вимкнені; пошук клубів із синку — поля,
 * порядок, межі, турніри клубу «у грі». Турніри створюються не в порядку `sortOrder`: порядок відповіді
 * мусить іти від нього, а не від порядку вставки.
 */
describe('Адмінка: турніри й клуби для форми новини', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let arsenalId: string;
  let premierLeague: CompetitionRef;
  let championsLeague: CompetitionRef;
  let carabaoCup: CompetitionRef;

  function searchClubs(query: Record<string, string> | string) {
    return admin.get(apiPath('/football/clubs/admin/search')).query(query);
  }

  async function foundClubs(search: string): Promise<ClubSearchResult[]> {
    const response = await searchClubs({ search }).expect(200);
    expectMatchesContract(response, 'get', '/football/clubs/admin/search');
    return response.body as ClubSearchResult[];
  }

  async function foundNames(search: string): Promise<string[]> {
    return (await foundClubs(search)).map((club) => club.name);
  }

  /** Турніри єдиного клубу, знайденого за запитом. */
  async function competitionSlugsOf(search: string): Promise<string[]> {
    const clubs = await foundClubs(search);
    expect(clubs).toHaveLength(1);
    return clubs[0].competitions.map((competition) => competition.slug);
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    const now = Date.now();

    // PL: поточний сезон з матчами, що йдуть і попереду; Arsenal і Chelsea
    const league = await seedFootballLeague(e2e.prisma);
    arsenalId = league.homeClubId;
    const chelseaId = league.awayClubId;
    premierLeague = {
      id: league.competitionId,
      slug: league.slug,
      name: 'Premier League',
    };
    const [atletico, barcelona, england, spain] = await Promise.all(
      [
        {
          slug: 'club-atletico-de-madrid',
          name: 'Club Atlético de Madrid',
          shortName: 'Atleti',
          tla: 'ATL',
        },
        {
          slug: 'fc-barcelona',
          name: 'FC Barcelona',
          shortName: 'Barça',
          tla: 'FCB',
        },
        {
          slug: 'england',
          name: 'England',
          shortName: 'England',
          tla: 'ENG',
          kind: ClubKind.NATIONAL,
        },
        {
          slug: 'spain',
          name: 'Spain',
          shortName: 'Spain',
          tla: 'ESP',
          kind: ClubKind.NATIONAL,
        },
      ].map((club) => e2e.prisma.club.create({ data: club })),
    );
    await e2e.prisma.club.createMany({
      data: [
        // Починається з «city», але за абеткою — після всіх «Alpha City NN»
        { slug: 'city-rovers', name: 'City Rovers' },
        ...Array.from({ length: CITY_CLUBS_COUNT }, (_, index) => ({
          slug: cityClubName(index).toLowerCase().replaceAll(' ', '-'),
          name: cityClubName(index),
        })),
      ],
    });

    const createCompetition = (data: Prisma.CompetitionCreateInput) =>
      e2e.prisma.competition.create({
        data,
        select: { id: true, slug: true, name: true },
      });
    carabaoCup = await createCompetition({
      slug: 'EFL',
      name: 'Carabao Cup',
      type: CompetitionType.CUP,
      sortOrder: 4,
    });
    const faCup = await createCompetition({
      slug: 'FAC',
      name: 'FA Cup',
      type: CompetitionType.CUP,
      sortOrder: 3,
      isActive: false,
    });
    championsLeague = await createCompetition({
      slug: 'CL',
      name: 'UEFA Champions League',
      type: CompetitionType.CUP,
      sortOrder: 2,
    });
    const euro = await createCompetition({
      slug: 'EC',
      name: 'European Championship',
      type: CompetitionType.CUP,
      sortOrder: 21,
    });
    const nationsLeague = await createCompetition({
      slug: 'UNL',
      name: 'UEFA Nations League',
      type: CompetitionType.CUP,
      sortOrder: 22,
    });

    const inFuture = new Date(now + 100 * DAY_MS);
    await createSeason(e2e.prisma, {
      competitionId: premierLeague.id,
      label: '2024/25',
      endDate: new Date('2025-05-25'),
      isCurrent: false,
      clubIds: [arsenalId, chelseaId],
      matchStatuses: [MatchStatus.SCHEDULED],
    });
    await createSeason(e2e.prisma, {
      competitionId: carabaoCup.id,
      label: '2025/26',
      endDate: inFuture,
      isCurrent: true,
      clubIds: [arsenalId, chelseaId],
      matchStatuses: [MatchStatus.SCHEDULED],
    });
    await createSeason(e2e.prisma, {
      competitionId: faCup.id,
      label: '2025/26',
      endDate: inFuture,
      isCurrent: true,
      clubIds: [arsenalId, chelseaId],
      matchStatuses: [MatchStatus.SCHEDULED],
    });
    // Усе зіграно, але від дати завершення минуло менше запасу (30 днів)
    await createSeason(e2e.prisma, {
      competitionId: championsLeague.id,
      label: '2025/26',
      endDate: new Date(now - 10 * DAY_MS),
      isCurrent: true,
      clubIds: [arsenalId, atletico.id, barcelona.id],
      matchStatuses: [MatchStatus.FINISHED],
    });
    // Сезон давно скінчився: остаточні статуси й давній SCHEDULED, який провайдер так і не оновив
    await createSeason(e2e.prisma, {
      competitionId: euro.id,
      label: '2024',
      endDate: new Date('2024-07-14'),
      isCurrent: true,
      clubIds: [england.id, spain.id],
      matchStatuses: [
        MatchStatus.SCHEDULED,
        MatchStatus.FINISHED,
        MatchStatus.AWARDED,
        MatchStatus.CANCELLED,
      ],
    });
    // Сезон давно скінчився (`endDate` від провайдера застарів), але матч, перенесений тиждень тому, ще попереду
    await createSeason(e2e.prisma, {
      competitionId: nationsLeague.id,
      label: '2024/25',
      endDate: new Date('2025-06-08'),
      isCurrent: true,
      clubIds: [england.id, spain.id],
      matchStatuses: [MatchStatus.POSTPONED, MatchStatus.FINISHED],
      lastKickoffAt: new Date(now - 7 * DAY_MS),
    });
  });
  afterAll(() => e2e.close());

  it('усі турніри, і вимкнені, — у порядку редакції: тип і чи ввімкнений', async () => {
    const response = await admin
      .get(apiPath('/football/leagues/admin/all'))
      .expect(200);
    expectMatchesContract(response, 'get', '/football/leagues/admin/all');
    const leagues = response.body as AdminLeague[];
    expect(
      leagues.map(({ slug, type, isActive }) => [slug, type, isActive]),
    ).toEqual([
      ['PL', 'LEAGUE', true],
      ['CL', 'CUP', true],
      ['FAC', 'CUP', false],
      ['EFL', 'CUP', true],
      ['EC', 'CUP', true],
      ['UNL', 'CUP', true],
    ]);
    expect(leagues[0]).toEqual({
      ...premierLeague,
      type: 'LEAGUE',
      isActive: true,
    });
  });

  it('клуб — поля чипа, коротка назва й код, турніри поточного сезону «у грі» в порядку редакції', async () => {
    // FA Cup вимкнено; PL 2024/25 — не поточний сезон; у CL усе зіграно, але запас ще не минув
    expect(await foundClubs('arsenal')).toEqual([
      {
        id: arsenalId,
        slug: 'arsenal',
        name: 'Arsenal FC',
        // Імена, за якими клуб знаходять, — адмінка порівнює з ними назву нового тегу
        shortName: 'Arsenal',
        tla: 'ARS',
        crestUrl: 'https://e2e.test/crest.svg',
        competitions: [premierLeague, championsLeague, carabaoCup],
      },
    ]);
    expect(await competitionSlugsOf('chelsea')).toEqual(['PL', 'EFL']);
    expect(await competitionSlugsOf('atleti')).toEqual(['CL']);
  });

  it('турнір «у грі»: перенесений тиждень тому матч — ще попереду; зіграні, технічні, скасовані й давній незіграний — ні', async () => {
    // EC — FINISHED / AWARDED / CANCELLED і SCHEDULED з 2024 (застарілі дані); у UNL — свіжий POSTPONED
    expect(await competitionSlugsOf('england')).toEqual(['UNL']);
    expect(await competitionSlugsOf('alpha city 01')).toEqual([]);
  });

  it('пошук за назвою, короткою назвою, кодом і адресою — без урахування регістру', async () => {
    expect(await foundNames('ARSENAL')).toEqual(['Arsenal FC']);
    // Лише коротка назва: у назві й адресі — «barcelona»
    expect(await foundNames('barça')).toEqual(['FC Barcelona']);
    // Лише код
    expect(await foundNames('fcb')).toEqual(['FC Barcelona']);
    // У назві «é»: запит без діакритики знаходить адреса
    for (const search of ['atletico', 'ATLÉTICO', 'atlético de']) {
      expect(await foundNames(search)).toEqual(['Club Atlético de Madrid']);
    }
  });

  it('пошук: «%» і «_» — як текст, а не шаблон LIKE', async () => {
    // Як шаблон «a_s» і «s%l» знайшли б «Arsenal FC»
    expect(await foundNames('a_s')).toEqual([]);
    expect(await foundNames('s%l')).toEqual([]);
  });

  it('спершу ті, у кого з запиту починається будь-яке з полів, далі — за абеткою', async () => {
    expect(await foundNames('fc')).toEqual([
      'FC Barcelona',
      'Arsenal FC',
      'Chelsea FC',
    ]);
  });

  it(`до ${ADMIN_CLUBS_SEARCH_RESULTS_MAX} клубів: ранжуються всі збіги, тож клуб, що починається з запиту, не губиться за абеткою`, async () => {
    expect(await foundNames('city')).toEqual([
      'City Rovers',
      ...Array.from(
        { length: ADMIN_CLUBS_SEARCH_RESULTS_MAX - 1 },
        (_, index) => cityClubName(index),
      ),
    ]);
  });

  it(`межі: ${ADMIN_CLUBS_SEARCH_MIN_LENGTH} і ${ADMIN_CLUBS_SEARCH_MAX_LENGTH} символів — можна; нічого не знайдено — порожній список`, async () => {
    for (const length of [
      ADMIN_CLUBS_SEARCH_MIN_LENGTH,
      ADMIN_CLUBS_SEARCH_MAX_LENGTH,
    ]) {
      expect(await foundNames('x'.repeat(length))).toEqual([]);
    }
  });

  it.each<[string, Record<string, string> | string]>([
    ['без запиту', {}],
    ['порожній запит', { search: '' }],
    [
      `коротший за ${ADMIN_CLUBS_SEARCH_MIN_LENGTH} символи`,
      { search: 'a'.repeat(ADMIN_CLUBS_SEARCH_MIN_LENGTH - 1) },
    ],
    ['короткий після trim', { search: '  a  ' }],
    [
      `довший за ${ADMIN_CLUBS_SEARCH_MAX_LENGTH}`,
      { search: 'x'.repeat(ADMIN_CLUBS_SEARCH_MAX_LENGTH + 1) },
    ],
    ['повтор параметра', 'search=arsenal&search=chelsea'],
  ])('%s → 400', async (_case, query) => {
    const response = await searchClubs(query).expect(400);
    expectMatchesContract(response, 'get', '/football/clubs/admin/search');
  });
});
