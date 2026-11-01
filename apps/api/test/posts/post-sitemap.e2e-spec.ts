import { randomUUID } from 'node:crypto';
import { PostStatus, Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const HOUR_MS = 60 * 60 * 1000;

function translation(languageCode: string, title: string) {
  return {
    languageCode,
    title,
    excerpt: 'A short summary of the news.',
    content: 'The full text of the news for the sitemap test.',
  };
}

interface SitemapIndexBody {
  months: { month: string; postCount: number; lastModifiedAt: string }[];
}

/**
 * Sitemap новин (D57): ті самі новини, що в стрічці (без чернеток, запланованих, видалених, архівних і без EN),
 * місяць — `publishedAt` в UTC, `lastmod` адреси — пізніша з дати публікації й правки перекладу; Google News —
 * лише за 48 год.
 */
describe('Sitemap новин: місяці, новини місяця, Google News (D57)', () => {
  let e2e: E2eApp;
  let adminUser: E2eUser;
  let admin: request.Agent;
  let ids: Record<
    'lateSeptember' | 'earlyOctober' | 'midOctober' | 'freshNews' | 'olderNews',
    { id: string; number: number }
  >;

  function guest() {
    return request(e2e.app.getHttpServer());
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

  function publishedAt(iso: string, languages: [string, string][]) {
    return createPost({
      status: 'PUBLISHED',
      publishedAt: iso,
      translations: languages.map(([code, title]) => translation(code, title)),
    });
  }

  /** Дата правки перекладу — в обхід API: `@updatedAt` Prisma поставив би now. */
  async function setTranslationUpdatedAt(
    postId: string,
    languageCode: string,
    iso: string,
  ) {
    await e2e.prisma.$executeRaw`
      UPDATE "PostTranslation" SET "updatedAt" = ${new Date(iso)}
      WHERE "postId" = ${postId} AND "languageCode" = ${languageCode}`;
  }

  /** Новина в обхід API: стан, якого API не створить (запланована з датою, що настала; без EN). */
  async function insertPost(
    status: PostStatus,
    iso: string,
    languageCode = 'en',
  ): Promise<void> {
    const id = randomUUID();
    await e2e.prisma.post.create({
      data: {
        id,
        slug: 'hidden-news',
        status,
        publishedAt: new Date(iso),
        authorId: adminUser.id,
        translations: { create: translation(languageCode, 'Hidden news') },
      },
    });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    adminUser = await createUser(e2e, Role.ADMIN);
    admin = await loginAs(e2e, adminUser);

    // 23:30 UTC 30 вересня — у Києві вже 1 жовтня, але місяць sitemap — вересень (UTC)
    const lateSeptember = await publishedAt('2025-09-30T23:30:00.000Z', [
      ['en', 'Late September news'],
      ['uk', 'Новина кінця вересня'],
    ]);
    await setTranslationUpdatedAt(
      lateSeptember.id,
      'en',
      '2025-09-30T20:00:00.000Z',
    );
    await setTranslationUpdatedAt(
      lateSeptember.id,
      'uk',
      '2025-10-05T10:00:00.000Z',
    );
    const earlyOctober = await publishedAt('2025-10-01T00:30:00.000Z', [
      ['en', 'Early October news'],
    ]);
    await setTranslationUpdatedAt(
      earlyOctober.id,
      'en',
      '2025-10-01T00:00:00.000Z',
    );
    const midOctober = await publishedAt('2025-10-20T12:00:00.000Z', [
      ['en', 'Mid October news'],
      ['uk', 'Новина середини жовтня'],
    ]);
    await setTranslationUpdatedAt(
      midOctober.id,
      'en',
      '2025-10-20T11:00:00.000Z',
    );
    await setTranslationUpdatedAt(
      midOctober.id,
      'uk',
      '2025-10-20T11:00:00.000Z',
    );

    // Жовтень 2025, але не в sitemap: архівна, видалена, запланована (воркер ще не пройшов), без EN, чернетка
    const archived = await publishedAt('2025-10-10T09:00:00.000Z', [
      ['en', 'Archived news'],
    ]);
    await admin
      .put(apiPath(`/posts/${archived.id}`))
      .send({ status: 'ARCHIVED' })
      .expect(200);
    const deleted = await publishedAt('2025-10-11T09:00:00.000Z', [
      ['en', 'Deleted news'],
    ]);
    await admin.delete(apiPath(`/posts/${deleted.id}`)).expect(200);
    await insertPost(PostStatus.SCHEDULED, '2025-10-12T09:00:00.000Z');
    await insertPost(PostStatus.PUBLISHED, '2025-10-13T09:00:00.000Z', 'uk');
    await createPost({ translations: [translation('en', 'Draft news')] });

    const now = Date.now();
    const freshNews = await publishedAt(new Date(now - HOUR_MS).toISOString(), [
      ['en', 'Fresh news'],
      ['uk', 'Свіжа новина'],
    ]);
    const olderNews = await publishedAt(
      new Date(now - 47 * HOUR_MS).toISOString(),
      [['en', 'News from yesterday']],
    );
    await publishedAt(new Date(now - 49 * HOUR_MS).toISOString(), [
      ['en', 'Too old for Google News'],
    ]);
    await insertPost(
      PostStatus.SCHEDULED,
      new Date(now - 2 * HOUR_MS).toISOString(),
    );

    ids = { lateSeptember, earlyOctober, midOctober, freshNews, olderNews };
  });
  afterAll(() => e2e.close());

  it('місяці — publishedAt в UTC, новіші першими; кількість і найсвіжіша зміна — лише живих новин', async () => {
    const response = await guest().get(apiPath('/posts/sitemap')).expect(200);
    expectMatchesContract(response, 'get', '/posts/sitemap');
    const { months } = response.body as SitemapIndexBody;

    const monthLabels = months.map((entry) => entry.month);
    expect(monthLabels).toEqual([...monthLabels].sort().reverse());
    expect(months.slice(-2)).toEqual([
      {
        month: '2025-10',
        postCount: 2,
        lastModifiedAt: '2025-10-20T12:00:00.000Z',
      },
      // Переклад UK правили після публікації — зміна місяця пізніша за дату публікації
      {
        month: '2025-09',
        postCount: 1,
        lastModifiedAt: '2025-10-05T10:00:00.000Z',
      },
    ]);
  });

  it('новини місяця: адреса кожною мовою перекладу, lastmod — пізніша з дати публікації й правки перекладу', async () => {
    const october = await guest()
      .get(apiPath('/posts/sitemap/2025-10'))
      .expect(200);
    expectMatchesContract(october, 'get', '/posts/sitemap/{month}');
    expect(october.body).toEqual({
      posts: [
        {
          number: ids.midOctober.number,
          slug: 'mid-october-news',
          translations: [
            { languageCode: 'en', lastModifiedAt: '2025-10-20T12:00:00.000Z' },
            { languageCode: 'uk', lastModifiedAt: '2025-10-20T12:00:00.000Z' },
          ],
        },
        {
          number: ids.earlyOctober.number,
          slug: 'early-october-news',
          // Без UK-перекладу — лише адреса EN (/uk/… без перекладу в sitemap не потрапляє, D34)
          translations: [
            { languageCode: 'en', lastModifiedAt: '2025-10-01T00:30:00.000Z' },
          ],
        },
      ],
    });

    const september = await guest()
      .get(apiPath('/posts/sitemap/2025-09'))
      .expect(200);
    expect(september.body).toEqual({
      posts: [
        {
          number: ids.lateSeptember.number,
          slug: 'late-september-news',
          translations: [
            { languageCode: 'en', lastModifiedAt: '2025-09-30T23:30:00.000Z' },
            { languageCode: 'uk', lastModifiedAt: '2025-10-05T10:00:00.000Z' },
          ],
        },
      ],
    });
    await guest()
      .get(apiPath('/posts/sitemap/2025-08'))
      .expect(200, { posts: [] });
  });

  it.each(['2025-13', '2025-00', '25-10', '2025-1', 'abc'])(
    'місяць %j → 400',
    async (month) => {
      const response = await guest()
        .get(apiPath(`/posts/sitemap/${month}`))
        .expect(400);
      expectMatchesContract(response, 'get', '/posts/sitemap/{month}');
    },
  );

  it('Google News — лише за 48 год, новіші першими, заголовок кожною мовою перекладу', async () => {
    const response = await guest()
      .get(apiPath('/posts/sitemap/news'))
      .expect(200);
    expectMatchesContract(response, 'get', '/posts/sitemap/news');
    const { posts } = response.body as {
      posts: { number: number; translations: unknown[] }[];
    };
    expect(posts.map((post) => post.number)).toEqual([
      ids.freshNews.number,
      ids.olderNews.number,
    ]);
    expect(posts[0]).toMatchObject({
      slug: 'fresh-news',
      translations: [
        { languageCode: 'en', title: 'Fresh news' },
        { languageCode: 'uk', title: 'Свіжа новина' },
      ],
    });
    expect(posts[1].translations).toEqual([
      { languageCode: 'en', title: 'News from yesterday' },
    ]);
  });
});
