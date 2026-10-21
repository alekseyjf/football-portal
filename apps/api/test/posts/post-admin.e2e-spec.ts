import {
  ADMIN_POSTS_PAGE_LIMIT_MAX,
  ADMIN_POSTS_SEARCH_MAX_LENGTH,
} from '@football-portal/validation';
import { CompetitionType, Role } from '@prisma/client';
import type request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DETAIL_TRANSLATION_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
  coverImageAlt: 'Arsenal players celebrate the late winner',
};
const DETAIL_TRANSLATION_UK = {
  languageCode: 'uk',
  title: 'Арсенал виграв дербі',
  excerpt: 'Пізній гол вирішив напружене лондонське дербі.',
  content: 'Господарі забили в компенсований час і взяли три очки.',
  coverImageAlt: 'Гравці «Арсенала» святкують пізній переможний гол',
};

/** Новини списку — у порядку створення; список адмінки — нові першими. */
const FULL_FITNESS = 'Arsenal at 100% fitness';
const FANS = '1000 fans welcome Chelsea';
const SIGNING = 'Chelsea unveil a new signing';
const PREVIEW = 'Weekend preview';
const PREVIEW_UK = 'Огляд туру: «Динамо» проти «Шахтаря»';
const RUMOUR = 'Old transfer rumour';

type ListQuery = Record<string, string | number>;

interface AdminListPost {
  status: string;
  isLive: boolean;
  translations: { languageCode: string; title: string }[];
}

interface AdminPageBody {
  data: AdminListPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Статус, який показує адмінка (`adminPostStatusLabel`): новина на сайті — PUBLISHED, інша — статус з БД. */
function statusShownInAdmin(post: AdminListPost): string {
  return post.isLive ? 'PUBLISHED' : post.status;
}

function englishTranslation(title: string) {
  return {
    languageCode: 'en',
    title,
    excerpt: 'A short summary of the news.',
    content: 'The full text of the news for the admin list test.',
  };
}

/**
 * Новини для адмінки (M1.4.8): пост для форми редагування — будь-якого статусу, з усім, що редагує форма;
 * список — сторінками, статус «як бачить редактор», пошук за заголовком будь-якою мовою.
 */
describe('Адмінка: список новин і новина для форми', () => {
  let e2e: E2eApp;
  let adminUser: E2eUser;
  let admin: request.Agent;
  let detailPost: { id: string; number: number };
  let deletedPostId: string;
  let ids: {
    premierLeague: string;
    championsLeague: string;
    arsenal: string;
    chelsea: string;
    derby: string;
    transfers: string;
  };

  function listPosts(query: ListQuery | string) {
    return admin.get(apiPath('/posts/admin/all')).query(query);
  }

  async function listPage(query: ListQuery): Promise<AdminPageBody> {
    const response = await listPosts(query).expect(200);
    expectMatchesContract(response, 'get', '/posts/admin/all');
    return response.body as AdminPageBody;
  }

  async function listTitles(query: ListQuery): Promise<string[]> {
    return (await listPage(query)).data.map(
      (post) =>
        post.translations.find(
          (translation) => translation.languageCode === 'en',
        )?.title ?? '',
    );
  }

  async function createPost(
    fields: object,
  ): Promise<{ id: string; number: number }> {
    const response = await admin
      .post(apiPath('/posts'))
      .send(fields)
      .expect(201);
    return response.body as { id: string; number: number };
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    adminUser = await createUser(e2e, Role.ADMIN);
    admin = await loginAs(e2e, adminUser);

    const league = await seedFootballLeague(e2e.prisma);
    const championsLeague = await e2e.prisma.competition.create({
      data: {
        slug: 'CL',
        name: 'UEFA Champions League',
        type: CompetitionType.CUP,
        sortOrder: 2,
      },
    });
    const [derby, transfers] = await Promise.all(
      [
        { slug: 'derby', en: 'Derby', uk: 'Дербі' },
        { slug: 'transfers', en: 'Transfers', uk: 'Трансфери' },
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
    ids = {
      premierLeague: league.competitionId,
      championsLeague: championsLeague.id,
      arsenal: league.homeClubId,
      chelsea: league.awayClubId,
      derby: derby.id,
      transfers: transfers.id,
    };

    // Чернетка з усім, що редагує форма; мови й зв'язки — не в тому порядку, у якому їх віддає API
    detailPost = await createPost({
      translations: [DETAIL_TRANSLATION_UK, DETAIL_TRANSLATION_EN],
      coverImageUrl: 'https://e2e.test/cover.jpg',
      coverImageCredit: 'Getty Images',
      videoUrl: 'https://e2e.test/video',
      sourceUrl: 'https://e2e.test/source',
      sourceName: 'E2E Sport',
      tagIds: [ids.transfers, ids.derby],
      competitionIds: [ids.championsLeague, ids.premierLeague],
      clubIds: [ids.chelsea, ids.arsenal],
    });
    const pastIso = new Date(Date.now() - HOUR_MS).toISOString();
    const futureIso = new Date(Date.now() + DAY_MS).toISOString();
    await createPost({
      status: 'PUBLISHED',
      publishedAt: pastIso,
      translations: [englishTranslation(FULL_FITNESS)],
    });
    await createPost({
      status: 'PUBLISHED',
      publishedAt: pastIso,
      translations: [englishTranslation(FANS)],
    });
    await createPost({
      status: 'SCHEDULED',
      publishedAt: futureIso,
      translations: [englishTranslation(SIGNING)],
    });
    // Запланована, чия дата настала: у БД — SCHEDULED, на сайті — уже видно
    const preview = await createPost({
      status: 'SCHEDULED',
      publishedAt: futureIso,
      translations: [
        englishTranslation(PREVIEW),
        {
          ...englishTranslation(PREVIEW),
          languageCode: 'uk',
          title: PREVIEW_UK,
        },
      ],
    });
    await e2e.prisma.post.update({
      where: { id: preview.id },
      data: { publishedAt: new Date(Date.now() - HOUR_MS) },
    });
    const rumour = await createPost({
      status: 'PUBLISHED',
      translations: [englishTranslation(RUMOUR)],
    });
    await admin
      .put(apiPath(`/posts/${rumour.id}`))
      .send({ status: 'ARCHIVED' })
      .expect(200);
    deletedPostId = (
      await createPost({
        status: 'PUBLISHED',
        translations: [englishTranslation('Deleted: Arsenal rumour')],
      })
    ).id;
    await admin.delete(apiPath(`/posts/${deletedPostId}`)).expect(200);
  });
  afterAll(() => e2e.close());

  it('новина для форми — і чернетка: усі переклади з текстом, медіа, джерело, зв’язки у форматі чипів', async () => {
    const response = await admin
      .get(apiPath(`/posts/admin/${detailPost.id}`))
      .expect(200);
    // Зайвих полів немає (контракт), дати — date-time; решта — тут
    expectMatchesContract(response, 'get', '/posts/admin/{id}');
    expect(response.body).toMatchObject({
      id: detailPost.id,
      number: detailPost.number,
      slug: 'arsenal-win-the-derby',
      status: 'DRAFT',
      publishedAt: null,
      isLive: false,
      coverImageUrl: 'https://e2e.test/cover.jpg',
      coverImageCredit: 'Getty Images',
      videoUrl: 'https://e2e.test/video',
      sourceUrl: 'https://e2e.test/source',
      sourceName: 'E2E Sport',
      author: {
        id: adminUser.id,
        name: 'E2E ADMIN',
        avatarUrl: null,
        isDeleted: false,
      },
      // Порядок мов — як на сайті (`Language.sortOrder`), а не як у запиті
      translations: [DETAIL_TRANSLATION_EN, DETAIL_TRANSLATION_UK],
      tags: [
        {
          id: ids.derby,
          slug: 'derby',
          translations: [
            { languageCode: 'en', name: 'Derby' },
            { languageCode: 'uk', name: 'Дербі' },
          ],
        },
        {
          id: ids.transfers,
          slug: 'transfers',
          translations: [
            { languageCode: 'en', name: 'Transfers' },
            { languageCode: 'uk', name: 'Трансфери' },
          ],
        },
      ],
      competitions: [
        { id: ids.premierLeague, slug: 'PL', name: 'Premier League' },
        { id: ids.championsLeague, slug: 'CL', name: 'UEFA Champions League' },
      ],
      clubs: [
        {
          id: ids.arsenal,
          slug: 'arsenal',
          name: 'Arsenal FC',
          crestUrl: 'https://e2e.test/crest.svg',
        },
        {
          id: ids.chelsea,
          slug: 'chelsea',
          name: 'Chelsea FC',
          crestUrl: 'https://e2e.test/crest.svg',
        },
      ],
    });
  });

  it('видалена й неіснуюча новина — 404 POST_NOT_FOUND', async () => {
    for (const id of [deletedPostId, 'no-such-post']) {
      const response = await admin
        .get(apiPath(`/posts/admin/${id}`))
        .expect(404);
      expectMatchesContract(response, 'get', '/posts/admin/{id}');
      expect(response.body).toMatchObject({ message: 'POST_NOT_FOUND' });
    }
  });

  it('список — нові першими, без видалених; сторінки й total', async () => {
    expect(await listPage({})).toMatchObject({
      total: 6,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(await listTitles({})).toEqual([
      RUMOUR,
      PREVIEW,
      SIGNING,
      FANS,
      FULL_FITNESS,
      DETAIL_TRANSLATION_EN.title,
    ]);
    expect(await listTitles({ limit: 4, page: 2 })).toEqual([
      FULL_FITNESS,
      DETAIL_TRANSLATION_EN.title,
    ]);
    expect(await listPage({ limit: 4, page: 2 })).toMatchObject({
      total: 6,
      page: 2,
      limit: 4,
      totalPages: 2,
    });
  });

  it('статус — як бачить редактор: запланована, чия дата настала, — серед PUBLISHED; кожна новина — в одному статусі', async () => {
    expect(await listTitles({ status: 'PUBLISHED' })).toEqual([
      PREVIEW,
      FANS,
      FULL_FITNESS,
    ]);
    expect(await listTitles({ status: 'SCHEDULED' })).toEqual([SIGNING]);
    expect(await listTitles({ status: 'DRAFT' })).toEqual([
      DETAIL_TRANSLATION_EN.title,
    ]);
    expect(await listTitles({ status: 'ARCHIVED' })).toEqual([RUMOUR]);
    expect(await listPage({ status: 'PUBLISHED' })).toMatchObject({
      total: 3,
      totalPages: 1,
    });
  });

  it('фільтр статусу збігається з підписом в адмінці: кожен рядок фільтра адмінка підпише цим статусом', async () => {
    for (const status of ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']) {
      const shownStatuses = (await listPage({ status })).data.map(
        statusShownInAdmin,
      );
      expect({ status, shownStatuses }).toEqual({
        status,
        shownStatuses: shownStatuses.map(() => status),
      });
    }
  });

  it('пошук — частина заголовка будь-якою мовою, без урахування регістру, і кирилиця', async () => {
    expect(await listTitles({ search: 'ARSENAL' })).toEqual([
      FULL_FITNESS,
      DETAIL_TRANSLATION_EN.title,
    ]);
    // Слово лише в українському заголовку
    expect(await listTitles({ search: 'виграв' })).toEqual([
      DETAIL_TRANSLATION_EN.title,
    ]);
    for (const search of ['динамо', 'ДИНАМО', '  Динамо  ']) {
      expect(await listTitles({ search })).toEqual([PREVIEW]);
    }
  });

  it('пошук: «%» і «_» — як текст, а не шаблон LIKE', async () => {
    // Як шаблон «100%» знайшов би й «1000 fans…», а «0_f» — «1000 fans» (будь-який символ між 0 і f)
    expect(await listTitles({ search: '100%' })).toEqual([FULL_FITNESS]);
    expect(await listTitles({ search: '0_f' })).toEqual([]);
  });

  it('пошук разом зі статусом — «і»; нічого не знайдено — порожня сторінка', async () => {
    expect(
      await listTitles({ search: 'chelsea', status: 'SCHEDULED' }),
    ).toEqual([SIGNING]);
    expect(await listPage({ search: 'no such title' })).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it(`межі: limit ${ADMIN_POSTS_PAGE_LIMIT_MAX} і пошук з ${ADMIN_POSTS_SEARCH_MAX_LENGTH} символів — можна`, async () => {
    expect(await listPage({ limit: ADMIN_POSTS_PAGE_LIMIT_MAX })).toMatchObject(
      { total: 6 },
    );
    expect(
      await listPage({ search: 'x'.repeat(ADMIN_POSTS_SEARCH_MAX_LENGTH) }),
    ).toMatchObject({ total: 0 });
  });

  it.each<[string, ListQuery | string]>([
    ['limit 0', { limit: 0 }],
    [
      `limit ${ADMIN_POSTS_PAGE_LIMIT_MAX + 1}`,
      { limit: ADMIN_POSTS_PAGE_LIMIT_MAX + 1 },
    ],
    ['page 0', { page: 0 }],
    ['невідомий статус', { status: 'LIVE' }],
    ['статус малими літерами', { status: 'published' }],
    ['порожній пошук', { search: '' }],
    ['пошук з самих пробілів', { search: '   ' }],
    [
      `пошук довший за ${ADMIN_POSTS_SEARCH_MAX_LENGTH}`,
      { search: 'x'.repeat(ADMIN_POSTS_SEARCH_MAX_LENGTH + 1) },
    ],
    ['повтор параметра', 'search=arsenal&search=chelsea'],
  ])('%s → 400', async (_case, query) => {
    const response = await listPosts(query).expect(400);
    expectMatchesContract(response, 'get', '/posts/admin/all');
  });
});
