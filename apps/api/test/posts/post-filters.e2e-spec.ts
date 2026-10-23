import {
  POSTS_FILTER_VALUES_MAX,
  TAG_SLUG_MAX_LENGTH,
} from '@football-portal/validation';
import { CompetitionType, Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Опубліковані новини — від новішої до старішої, як у стрічці. */
const CHELSEA_TRANSFER = 'Chelsea sign a winger';
const CHELSEA_INJURY = 'Chelsea captain injured';
const ARSENAL_CLUB_NEWS = 'Arsenal open a new training centre';
const ARSENAL_TRANSFER = 'Arsenal sign a striker';
const ROUND_UP = 'Weekend football round-up';

type FeedQuery = Record<string, string | number>;

interface FeedPageBody {
  data: { title: string }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

function slugList(count: number): string {
  return Array.from({ length: count }, (_, index) => `tag-${index}`).join(',');
}

/**
 * `GET /posts?tags=&competition=&club=` (D45, D46): усередині фільтра — «будь-який», між фільтрами — «і»,
 * турнір — лише явна прив'язка новини; фільтр лише звужує стрічку — правило «що бачить публіка» лишається.
 */
describe('Стрічка з фільтрами: теги, турнір, клуб (D45, D46)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;

  function getFeed(query: FeedQuery | string) {
    return request(e2e.app.getHttpServer()).get(apiPath('/posts')).query(query);
  }

  async function feedPage(query: FeedQuery): Promise<FeedPageBody> {
    const response = await getFeed(query).expect(200);
    expectMatchesContract(response, 'get', '/posts');
    return response.body as FeedPageBody;
  }

  async function feedTitles(query: FeedQuery): Promise<string[]> {
    return (await feedPage(query)).data.map((post) => post.title);
  }

  async function createPost(title: string, fields: object): Promise<string> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({
        translations: [
          {
            languageCode: 'en',
            title,
            excerpt: 'A short summary of the news.',
            content: 'The full text of the news for the feed filters test.',
          },
        ],
        ...fields,
      })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));

    // Обидва клуби — учасники сезону PL: «Арсенал» без прив'язки до PL перевіряє D46
    const premierLeague = await seedFootballLeague(e2e.prisma);
    const championsLeague = await e2e.prisma.competition.create({
      data: {
        slug: 'CL',
        name: 'UEFA Champions League',
        type: CompetitionType.CUP,
      },
    });
    // Теги — як їх створює API: назви обома мовами (D51)
    const [transfers, injuries] = await Promise.all(
      [
        { slug: 'transfers', en: 'Transfers', uk: 'Трансфери' },
        { slug: 'injuries', en: 'Injuries', uk: 'Травми' },
      ].map((tag) =>
        e2e.prisma.tag.create({
          data: {
            slug: tag.slug,
            translations: {
              create: [
                { languageCode: 'en', name: tag.en },
                { languageCode: 'uk', name: tag.uk },
              ],
            },
          },
        }),
      ),
    );
    const arsenal = premierLeague.homeClubId;
    const chelsea = premierLeague.awayClubId;
    const arsenalTransfer = {
      tagIds: [transfers.id],
      clubIds: [arsenal],
      competitionIds: [premierLeague.competitionId],
    };

    await createPost(CHELSEA_TRANSFER, {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(1),
      tagIds: [transfers.id],
      clubIds: [chelsea],
      competitionIds: [championsLeague.id],
    });
    await createPost(CHELSEA_INJURY, {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(2),
      tagIds: [injuries.id],
      clubIds: [chelsea],
      competitionIds: [premierLeague.competitionId],
    });
    await createPost(ARSENAL_CLUB_NEWS, {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(3),
      clubIds: [arsenal],
    });
    await createPost(ARSENAL_TRANSFER, {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(4),
      ...arsenalTransfer,
    });
    await createPost(ROUND_UP, {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(5),
    });

    // Ті самі зв'язки, що й в ARSENAL_TRANSFER, але публіка новин не бачить
    await createPost('Draft: Arsenal transfer target', arsenalTransfer);
    await createPost('Scheduled: Arsenal unveil a signing', {
      status: 'SCHEDULED',
      publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
      ...arsenalTransfer,
    });
    const deletedId = await createPost('Deleted: Arsenal transfer rumour', {
      status: 'PUBLISHED',
      publishedAt: hoursAgoIso(6),
      ...arsenalTransfer,
    });
    await admin.delete(apiPath(`/posts/${deletedId}`)).expect(200);
  });
  afterAll(() => e2e.close());

  it('без фільтрів — уся стрічка', async () => {
    expect(await feedTitles({})).toEqual([
      CHELSEA_TRANSFER,
      CHELSEA_INJURY,
      ARSENAL_CLUB_NEWS,
      ARSENAL_TRANSFER,
      ROUND_UP,
    ]);
  });

  it('теги: новини з будь-яким із тегів фільтра', async () => {
    expect(await feedTitles({ tags: 'transfers' })).toEqual([
      CHELSEA_TRANSFER,
      ARSENAL_TRANSFER,
    ]);
    expect(await feedTitles({ tags: 'transfers,injuries' })).toEqual([
      CHELSEA_TRANSFER,
      CHELSEA_INJURY,
      ARSENAL_TRANSFER,
    ]);
  });

  it('турнір — лише новини з прив’язкою до нього: новина клубу ліги без турніру в новини ліги не потрапляє (D46)', async () => {
    expect(await feedTitles({ competition: 'PL' })).toEqual([
      CHELSEA_INJURY,
      ARSENAL_TRANSFER,
    ]);
    expect(await feedTitles({ competition: 'PL,CL' })).toEqual([
      CHELSEA_TRANSFER,
      CHELSEA_INJURY,
      ARSENAL_TRANSFER,
    ]);
  });

  it('клуби: новини з будь-яким із клубів фільтра', async () => {
    expect(await feedTitles({ club: 'arsenal' })).toEqual([
      ARSENAL_CLUB_NEWS,
      ARSENAL_TRANSFER,
    ]);
    expect(await feedTitles({ club: 'arsenal,chelsea' })).toEqual([
      CHELSEA_TRANSFER,
      CHELSEA_INJURY,
      ARSENAL_CLUB_NEWS,
      ARSENAL_TRANSFER,
    ]);
  });

  it('різні фільтри — разом («і»); чернетка, запланована й видалена з тими самими зв’язками не потрапляють', async () => {
    expect(
      await feedTitles({
        tags: 'transfers',
        competition: 'PL',
        club: 'arsenal',
      }),
    ).toEqual([ARSENAL_TRANSFER]);
    expect(await feedTitles({ tags: 'transfers', club: 'chelsea' })).toEqual([
      CHELSEA_TRANSFER,
    ]);
    expect(await feedTitles({ tags: 'injuries', club: 'arsenal' })).toEqual([]);
  });

  it('невідомий slug — порожня сторінка (200), а поруч з відомим не заважає', async () => {
    const unknownSlugQueries: FeedQuery[] = [
      { tags: 'no-such-tag' },
      { competition: 'XX' },
      { club: 'no-such-club' },
    ];
    for (const query of unknownSlugQueries) {
      expect(await feedPage(query)).toMatchObject({
        data: [],
        total: 0,
        totalPages: 0,
      });
    }
    expect(await feedTitles({ tags: 'transfers,no-such-tag' })).toEqual([
      CHELSEA_TRANSFER,
      ARSENAL_TRANSFER,
    ]);
  });

  it('total і totalPages — з фільтром: сторінки рахуються лише за знайденими новинами', async () => {
    expect(
      await feedPage({ club: 'arsenal,chelsea', limit: 3, page: 2 }),
    ).toEqual({
      data: [expect.objectContaining({ title: ARSENAL_TRANSFER })],
      total: 4,
      page: 2,
      limit: 3,
      totalPages: 2,
    });
  });

  it(`рівно ${POSTS_FILTER_VALUES_MAX} значень у фільтрі — можна`, async () => {
    expect(
      await feedPage({ tags: slugList(POSTS_FILTER_VALUES_MAX) }),
    ).toMatchObject({ total: 0 });
  });

  it.each<[string, FeedQuery | string]>([
    [
      `${POSTS_FILTER_VALUES_MAX + 1} значення`,
      { tags: slugList(POSTS_FILTER_VALUES_MAX + 1) },
    ],
    ['велика літера в slug-у тегу', { tags: 'Transfers' }],
    ['порожнє значення між комами', { tags: 'transfers,,injuries' }],
    ['порожній параметр', { tags: '' }],
    [
      `slug тегу довший за ${TAG_SLUG_MAX_LENGTH}`,
      { tags: 'x'.repeat(TAG_SLUG_MAX_LENGTH + 1) },
    ],
    ['турніри не через кому', { competition: 'PL;CL' }],
    ['підкреслення в slug-у клубу', { club: 'arsenal_fc' }],
    ['повтор параметра замість коми', 'tags=transfers&tags=injuries'],
  ])('%s → 400', async (_case, query) => {
    const response = await getFeed(query).expect(400);
    expectMatchesContract(response, 'get', '/posts');
  });
});
