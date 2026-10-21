import {
  TAG_NAME_MAX_LENGTH,
  TAG_SLUG_MAX_LENGTH,
} from '@football-portal/validation';
import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

interface TagName {
  languageCode: string;
  name: string;
}

interface AdminTagBody {
  id: string;
  slug: string;
  translations: TagName[];
  postCount: number;
}

interface PublicTagBody {
  id: string;
  slug: string;
  name: string;
}

interface CreatedPostBody {
  id: string;
  number: number;
}

const TRANSFERS_EN: TagName = { languageCode: 'en', name: 'Transfer news' };
const TRANSFERS_UK: TagName = { languageCode: 'uk', name: 'Трансфери' };

/** Мова є в `Language`, але вимкнена — назва нею не зберігається (P3-3). */
const DISABLED_LANGUAGE = {
  code: 'es',
  name: 'Español',
  isActive: false,
  sortOrder: 3,
};

const POST_EN = {
  languageCode: 'en',
  title: 'Arsenal sign a new striker',
  excerpt: 'The club confirmed the deal on deadline day.',
  content: 'The striker signed a five-year contract after passing a medical.',
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Скільки чекати, доки запит застрягне на блокуванні: 100 × 50 мс = 5 с. */
const LOCK_WAIT_ATTEMPTS = 100;
const LOCK_WAIT_POLL_MS = 50;

/** Запланована на завтра — ще не на сайті. */
function tomorrowIso(): string {
  return new Date(Date.now() + DAY_MS).toISOString();
}

/** Чекає, доки вставка `PostTag` стане в чергу на блокування рядка тегу (його тримає видалення). */
async function waitForBlockedPostTagInsert(prisma: PrismaClient) {
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND query LIKE '%"PostTag"%'`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error('INSERT into PostTag never waited for the deleted tag');
}

describe('Теги: керування адміном, публічні списки, видалення (D17, D45)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let transfersTag: AdminTagBody;
  let injuriesTag: AdminTagBody;
  let publishedPost: CreatedPostBody;

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  async function createTag(body: object): Promise<AdminTagBody> {
    const response = await admin.post(apiPath('/tags')).send(body).expect(201);
    return response.body as AdminTagBody;
  }

  async function createPost(fields: object): Promise<CreatedPostBody> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ translations: [POST_EN], ...fields })
      .expect(201);
    return response.body as CreatedPostBody;
  }

  async function publicTagNames(lang: string): Promise<string[]> {
    const response = await guest()
      .get(apiPath('/tags'))
      .query({ lang })
      .expect(200);
    expectMatchesContract(response, 'get', '/tags');
    return (response.body as PublicTagBody[]).map(({ name }) => name);
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    // До першого запиту, що читає мови: LanguageService кешує їх на 60 с
    await e2e.prisma.language.create({ data: DISABLED_LANGUAGE });
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('створення: назви EN і UK, slug — з англійської назви; у списку адмінки — усі назви й 0 новин', async () => {
    const created = await admin
      .post(apiPath('/tags'))
      .send({ translations: [TRANSFERS_EN, TRANSFERS_UK] })
      .expect(201);
    expectMatchesContract(created, 'post', '/tags');
    transfersTag = created.body as AdminTagBody;
    expect(transfersTag).toMatchObject({
      slug: 'transfer-news',
      translations: [TRANSFERS_EN, TRANSFERS_UK],
      postCount: 0,
    });

    const list = await admin.get(apiPath('/tags/admin/all')).expect(200);
    expectMatchesContract(list, 'get', '/tags/admin/all');
    expect(list.body).toEqual([transfersTag]);
  });

  it('той самий slug → 409 TAG_SLUG_TAKEN: і з іншим написанням назви, і з явним slug-ом', async () => {
    const sameName = await admin
      .post(apiPath('/tags'))
      .send({ translations: [{ languageCode: 'en', name: 'TRANSFER NEWS!' }] })
      .expect(409);
    expectMatchesContract(sameName, 'post', '/tags');
    expect(sameName.body).toMatchObject({ message: 'TAG_SLUG_TAKEN' });

    const sameSlug = await admin
      .post(apiPath('/tags'))
      .send({
        slug: 'transfer-news',
        translations: [{ languageCode: 'en', name: 'Rumours' }],
      })
      .expect(409);
    expect(sameSlug.body).toMatchObject({ message: 'TAG_SLUG_TAKEN' });
    expect(await e2e.prisma.tag.count()).toBe(1);
  });

  it('без англійської назви → 400 DEFAULT_TRANSLATION_REQUIRED, назва вимкненою мовою → 400 UNSUPPORTED_LANGUAGE', async () => {
    const withoutEnglish = await admin
      .post(apiPath('/tags'))
      .send({ translations: [{ languageCode: 'uk', name: 'Травми' }] })
      .expect(400);
    expectMatchesContract(withoutEnglish, 'post', '/tags');
    expect(withoutEnglish.body).toMatchObject({
      message: 'DEFAULT_TRANSLATION_REQUIRED',
    });

    const disabledLanguage = await admin
      .post(apiPath('/tags'))
      .send({
        translations: [
          { languageCode: 'en', name: 'Injuries' },
          { languageCode: DISABLED_LANGUAGE.code, name: 'Lesiones' },
        ],
      })
      .expect(400);
    expect(disabledLanguage.body).toMatchObject({
      message: 'UNSUPPORTED_LANGUAGE',
    });
    expect(await e2e.prisma.tag.count()).toBe(1);
  });

  it('англійська назва без латиниці: без slug-а → 400 TAG_SLUG_REQUIRED, з явним slug-ом — створено', async () => {
    // Помилка редактора — українська назва в полі англійської; fallback-slug злив би всі такі теги в один
    const cyrillicName = [{ languageCode: 'en', name: 'Травми' }];
    const withoutSlug = await admin
      .post(apiPath('/tags'))
      .send({ translations: cyrillicName })
      .expect(400);
    expectMatchesContract(withoutSlug, 'post', '/tags');
    expect(withoutSlug.body).toMatchObject({ message: 'TAG_SLUG_REQUIRED' });

    injuriesTag = await createTag({
      slug: 'injuries',
      translations: cyrillicName,
    });
    expect(injuriesTag.slug).toBe('injuries');
  });

  it(`назва з пробілів чи довша за ${TAG_NAME_MAX_LENGTH} символів → 400; рівно ${TAG_NAME_MAX_LENGTH} — можна`, async () => {
    for (const name of ['   ', 'x'.repeat(TAG_NAME_MAX_LENGTH + 1)]) {
      const response = await admin
        .post(apiPath('/tags'))
        .send({ translations: [{ languageCode: 'en', name }] })
        .expect(400);
      expectMatchesContract(response, 'post', '/tags');
    }
    const longest = await createTag({
      translations: [
        { languageCode: 'en', name: 'x'.repeat(TAG_NAME_MAX_LENGTH) },
      ],
    });
    expect(longest.slug).toBe('x'.repeat(TAG_NAME_MAX_LENGTH));
  });

  it('перейменування: назви — upsert за мовою, інші лишаються; slug не змінюється, навіть переданий', async () => {
    const renamed = await admin
      .put(apiPath(`/tags/${transfersTag.id}`))
      .send({
        slug: 'transfer-window',
        translations: [{ languageCode: 'en', name: 'Transfer window' }],
      })
      .expect(200);
    expectMatchesContract(renamed, 'put', '/tags/{id}');
    expect(renamed.body).toEqual({
      ...transfersTag,
      translations: [
        { languageCode: 'en', name: 'Transfer window' },
        TRANSFERS_UK,
      ],
    });

    // Виправити англійську назву й додати українську — одним запитом
    const fixed = await admin
      .put(apiPath(`/tags/${injuriesTag.id}`))
      .send({
        translations: [
          { languageCode: 'en', name: 'Injuries' },
          { languageCode: 'uk', name: 'Травми' },
        ],
      })
      .expect(200);
    expect(fixed.body).toMatchObject({
      slug: 'injuries',
      translations: [
        { languageCode: 'en', name: 'Injuries' },
        { languageCode: 'uk', name: 'Травми' },
      ],
    });
  });

  it('перейменування неіснуючого тегу → 404 TAG_NOT_FOUND', async () => {
    const response = await admin
      .put(apiPath('/tags/missing-tag'))
      .send({ translations: [{ languageCode: 'en', name: 'Ghost' }] })
      .expect(404);
    expectMatchesContract(response, 'put', '/tags/{id}');
    expect(response.body).toMatchObject({ message: 'TAG_NOT_FOUND' });
  });

  it('публічний список — лише теги з опублікованими новинами, за абеткою мовою запиту; без перекладу — англійською', async () => {
    const derbyTag = await createTag({
      translations: [
        { languageCode: 'en', name: 'Derby' },
        { languageCode: 'uk', name: 'Дербі' },
      ],
    });
    const euroTag = await createTag({
      translations: [
        { languageCode: 'en', name: 'Euro 2028' },
        { languageCode: 'uk', name: 'Євро-2028' },
      ],
    });
    const varTag = await createTag({
      translations: [{ languageCode: 'en', name: 'VAR' }],
    });
    const draftOnlyTag = await createTag({
      translations: [{ languageCode: 'en', name: 'Exclusive' }],
    });
    const scheduledOnlyTag = await createTag({
      translations: [{ languageCode: 'en', name: 'Preview' }],
    });
    const deletedOnlyTag = await createTag({
      translations: [{ languageCode: 'en', name: 'Old story' }],
    });

    publishedPost = await createPost({
      status: 'PUBLISHED',
      tagIds: [
        transfersTag.id,
        derbyTag.id,
        euroTag.id,
        injuriesTag.id,
        varTag.id,
      ],
    });
    await createPost({ tagIds: [transfersTag.id, draftOnlyTag.id] });
    await createPost({
      status: 'SCHEDULED',
      publishedAt: tomorrowIso(),
      tagIds: [scheduledOnlyTag.id],
    });
    const deletedPost = await createPost({
      status: 'PUBLISHED',
      tagIds: [transfersTag.id, deletedOnlyTag.id],
    });
    await admin.delete(apiPath(`/posts/${deletedPost.id}`)).expect(200);

    // За кодами символів «Євро» стало б першим
    expect(await publicTagNames('uk')).toEqual([
      'Дербі',
      'Євро-2028',
      'Травми',
      'Трансфери',
      'VAR',
    ]);
    expect(await publicTagNames('en')).toEqual([
      'Derby',
      'Euro 2028',
      'Injuries',
      'Transfer window',
      'VAR',
    ]);
  });

  it('тег за slug-ом — назва мовою запиту, і без опублікованих новин; невідомий → 404, slug не того формату → 400', async () => {
    const derby = await guest()
      .get(apiPath('/tags/derby'))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(derby, 'get', '/tags/{slug}');
    expect(derby.body).toMatchObject({ slug: 'derby', name: 'Дербі' });

    const withoutUkrainian = await guest()
      .get(apiPath('/tags/var'))
      .query({ lang: 'uk' })
      .expect(200);
    expect(withoutUkrainian.body).toMatchObject({ name: 'VAR' });

    // Сторінка тегу є й тоді, коли новини з ним — лише чернетки (noindex — M1.8)
    await guest().get(apiPath('/tags/exclusive')).expect(200);

    const unknown = await guest().get(apiPath('/tags/no-such-tag')).expect(404);
    expectMatchesContract(unknown, 'get', '/tags/{slug}');
    expect(unknown.body).toMatchObject({ message: 'TAG_NOT_FOUND' });

    const invalid = await guest().get(apiPath('/tags/Derby')).expect(400);
    expectMatchesContract(invalid, 'get', '/tags/{slug}');
  });

  it('видалення: у списку адмінки — скільки новин втратять тег (і чернетки, без видалених); тег зникає з усіх; повтор → 404', async () => {
    const before = await admin.get(apiPath('/tags/admin/all')).expect(200);
    const transfersBefore = (before.body as AdminTagBody[]).find(
      ({ id }) => id === transfersTag.id,
    );
    expect(transfersBefore?.postCount).toBe(2);

    const deleted = await admin
      .delete(apiPath(`/tags/${transfersTag.id}`))
      .expect(200);
    expectMatchesContract(deleted, 'delete', '/tags/{id}');
    expect(deleted.body).toEqual({ id: transfersTag.id });

    expect(
      await e2e.prisma.postTag.count({ where: { tagId: transfersTag.id } }),
    ).toBe(0);
    const post = await guest()
      .get(apiPath(`/posts/${publishedPost.number}`))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(post, 'get', '/posts/{number}');
    expect((post.body as { tags: PublicTagBody[] }).tags).toEqual([
      expect.objectContaining({ slug: 'derby', name: 'Дербі' }),
      expect.objectContaining({ slug: 'euro-2028', name: 'Євро-2028' }),
      expect.objectContaining({ slug: 'injuries', name: 'Травми' }),
      expect.objectContaining({ slug: 'var', name: 'VAR' }),
    ]);

    const repeat = await admin
      .delete(apiPath(`/tags/${transfersTag.id}`))
      .expect(404);
    expectMatchesContract(repeat, 'delete', '/tags/{id}');
    expect(repeat.body).toMatchObject({ message: 'TAG_NOT_FOUND' });
  });

  it('БД сама не прийме slug не того формату чи назву з самих пробілів — і в обхід API (сід, SQL); пробіли всередині назви — можна', async () => {
    for (const slug of [
      'Transfer News',
      'transfer--news',
      'x'.repeat(TAG_SLUG_MAX_LENGTH + 1),
    ]) {
      await expect(e2e.prisma.tag.create({ data: { slug } })).rejects.toThrow(
        /Tag_slug_format_check/,
      );
    }
    for (const name of ['   ', 'x'.repeat(TAG_NAME_MAX_LENGTH + 1)]) {
      await expect(
        e2e.prisma.tag.create({
          data: {
            slug: 'bad-name',
            translations: { create: { languageCode: 'en', name } },
          },
        }),
      ).rejects.toThrow(/TagTranslation_name_check/);
    }
    await e2e.prisma.tag.create({
      data: {
        slug: 'match-reports',
        translations: {
          create: [
            { languageCode: 'en', name: 'Match reports' },
            { languageCode: 'uk', name: 'Звіти з матчів' },
          ],
        },
      },
    });
  });

  it('тег видалили, поки зберігається новина з ним → 400 UNKNOWN_TAG, а не 500 (FK)', async () => {
    const lateTag = await createTag({
      translations: [{ languageCode: 'en', name: 'Late drama' }],
    });
    let releaseDeletion!: () => void;
    const deletionReleased = new Promise<void>((resolve) => {
      releaseDeletion = resolve;
    });
    let markTagDeleted!: () => void;
    const tagDeleted = new Promise<void>((resolve) => {
      markTagDeleted = resolve;
    });
    // Видалення тримає окрема транзакція: рядок тегу заблоковано, а для інших запитів тег ще є
    const deletion = e2e.prisma.$transaction(
      async (tx) => {
        await tx.tag.delete({ where: { id: lateTag.id } });
        markTagDeleted();
        await deletionReleased;
      },
      { timeout: 15_000 },
    );
    await tagDeleted;

    // Перевірка зв'язків тег бачить, а вставка `PostTag` чекає, доки видалення завершиться
    const saving = admin
      .post(apiPath('/posts'))
      .send({ translations: [POST_EN], tagIds: [lateTag.id] })
      .then((response) => response);
    try {
      await waitForBlockedPostTagInsert(e2e.prisma);
    } finally {
      releaseDeletion();
      await deletion;
    }

    const response = await saving;
    expect(response.status).toBe(400);
    expectMatchesContract(response, 'post', '/posts');
    expect(response.body).toMatchObject({ message: 'UNKNOWN_TAG' });
  });
});
