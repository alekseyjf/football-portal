import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=630&fit=crop&q=80';
const OTHER_COVER_IMAGE_URL =
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg';

const DERBY_EN = {
  languageCode: 'en',
  title: 'Arsenal beat Chelsea in the derby',
  excerpt: 'A late header settled the London derby.',
  content: 'A substitute scored with a header in the 88th minute.',
};
const DERBY_UK = {
  languageCode: 'uk',
  title: '«Арсенал» обіграв «Челсі» в дербі',
  excerpt: 'Пізній гол головою вирішив лондонське дербі.',
  content: 'Гравець з лави запасних забив головою на 88-й хвилині.',
};

interface CreatedPostBody {
  id: string;
  number: number;
  publishedAt: string;
}

interface PostDetailBody {
  resolvedLanguage: string;
  lastModifiedAt: string;
}

interface SitemapMonthBody {
  posts: {
    number: number;
    translations: { languageCode: string; lastModifiedAt: string }[];
  }[];
}

/**
 * Дата зміни новини (OQ-26, M1.8.4): `lastModifiedAt` новини (сайт — `dateModified` і `article:modified_time`) і
 * `lastmod` її адреси в sitemap — одне значення, і зсуває його лише текст перекладу: заголовок, анонс, текст.
 */
describe('Дата зміни новини: сторінка = sitemap, лише від тексту перекладу (OQ-26)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let post: CreatedPostBody;
  let tagId: string;

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  async function createPublishedPost(fields: object): Promise<CreatedPostBody> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ status: 'PUBLISHED', ...fields })
      .expect(201);
    return response.body as CreatedPostBody;
  }

  async function updatePost(fields: object): Promise<void> {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send(fields)
      .expect(200);
  }

  async function detailOf(
    target: CreatedPostBody,
    lang: string,
  ): Promise<PostDetailBody> {
    const response = await guest()
      .get(apiPath(`/posts/${target.number}?lang=${lang}`))
      .expect(200);
    expectMatchesContract(response, 'get', '/posts/{number}');
    return response.body as PostDetailBody;
  }

  /** `lastModifiedAt` адрес новини в sitemap її місяця — за мовою. */
  async function sitemapDatesOf(
    target: CreatedPostBody,
  ): Promise<Record<string, string>> {
    const month = target.publishedAt.slice(0, 7);
    const response = await guest()
      .get(apiPath(`/posts/sitemap/${month}`))
      .expect(200);
    const entry = (response.body as SitemapMonthBody).posts.find(
      (candidate) => candidate.number === target.number,
    );
    return Object.fromEntries(
      (entry?.translations ?? []).map((translation) => [
        translation.languageCode,
        translation.lastModifiedAt,
      ]),
    );
  }

  /** Дата зміни кожною мовою — однакова на сторінці новини й у sitemap. */
  async function lastModifiedDates(): Promise<Record<string, string>> {
    const sitemapDates = await sitemapDatesOf(post);
    const pageDates = {
      en: (await detailOf(post, 'en')).lastModifiedAt,
      uk: (await detailOf(post, 'uk')).lastModifiedAt,
    };
    expect(pageDates).toEqual(sitemapDates);
    return pageDates;
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));

    const tag = await admin
      .post(apiPath('/tags'))
      .send({
        translations: [
          { languageCode: 'en', name: 'Derbies' },
          { languageCode: 'uk', name: 'Дербі' },
        ],
      })
      .expect(201);
    tagId = (tag.body as { id: string }).id;

    post = await createPublishedPost({
      coverImageUrl: COVER_IMAGE_URL,
      coverImageCredit: 'Stuart MacFarlane / Getty Images',
      translations: [
        { ...DERBY_EN, coverImageAlt: 'Arsenal players celebrate' },
        { ...DERBY_UK, coverImageAlt: 'Гравці «Арсенала» святкують' },
      ],
    });
  });
  afterAll(() => e2e.close());

  it('нова опублікована новина змінена тоді ж, коли опублікована, — кожною мовою', async () => {
    expect(await lastModifiedDates()).toEqual({
      en: post.publishedAt,
      uk: post.publishedAt,
    });
  });

  it.each<[string, () => object]>([
    ['теги', () => ({ tagIds: [tagId] })],
    [
      'нове фото з описами (як шле адмінка)',
      () => ({
        coverImageUrl: OTHER_COVER_IMAGE_URL,
        coverImageCredit: 'Pexels',
        translations: [
          { ...DERBY_EN, coverImageAlt: 'Ball on the pitch' },
          { ...DERBY_UK, coverImageAlt: "М'яч на газоні" },
        ],
      }),
    ],
    [
      'лише опис фото',
      () => ({
        translations: [
          { ...DERBY_EN, coverImageAlt: 'A ball before kick-off' },
        ],
      }),
    ],
    ['лише підпис фото', () => ({ coverImageCredit: 'Pexels / Pixabay' })],
    [
      'той самий текст обома мовами ще раз',
      () => ({ translations: [DERBY_EN, DERBY_UK] }),
    ],
    ['фото прибрали (описи очищено)', () => ({ coverImageUrl: null })],
  ])('%s — дата зміни та сама', async (_change, fields) => {
    await updatePost(fields());

    expect(await lastModifiedDates()).toEqual({
      en: post.publishedAt,
      uk: post.publishedAt,
    });
  });

  it('змінили заголовок англійською — нова дата лише в EN, сторінка й sitemap збігаються', async () => {
    await updatePost({
      translations: [
        { ...DERBY_EN, title: 'Arsenal edge Chelsea in the derby' },
      ],
    });

    const dates = await lastModifiedDates();
    expect(Date.parse(dates.en)).toBeGreaterThan(Date.parse(post.publishedAt));
    expect(dates.uk).toBe(post.publishedAt);
  });

  it('змінили текст українською — нова дата UK, EN — та сама', async () => {
    const before = await lastModifiedDates();

    await updatePost({
      translations: [{ ...DERBY_UK, content: `${DERBY_UK.content} Оновлено.` }],
    });

    const after = await lastModifiedDates();
    expect(after.en).toBe(before.en);
    expect(Date.parse(after.uk)).toBeGreaterThan(Date.parse(before.uk));
  });

  it('без українського перекладу /uk/ віддає дату англійського — як адреса /en/ у sitemap', async () => {
    const englishOnly = await createPublishedPost({
      translations: [{ ...DERBY_EN, title: 'Chelsea sign a new striker' }],
    });

    const page = await detailOf(englishOnly, 'uk');
    expect(page.resolvedLanguage).toBe('en');
    expect(await sitemapDatesOf(englishOnly)).toEqual({
      en: page.lastModifiedAt,
    });
  });
});
