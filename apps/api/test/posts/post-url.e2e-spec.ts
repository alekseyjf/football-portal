import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const TRANSLATION_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface AdminPostBody {
  id: string;
  number: number;
  slug: string;
}

/** URL новини — `/{locale}/news/{slug}-{number}`: новину визначає номер, slug — з EN-заголовка (D24). */
describe('URL новини: номер і slug (D24)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;

  async function createPost(
    body: Record<string, unknown>,
  ): Promise<AdminPostBody> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ translations: [TRANSLATION_EN], ...body })
      .expect(201);
    return response.body as AdminPostBody;
  }

  async function updatePost(
    id: string,
    body: Record<string, unknown>,
  ): Promise<AdminPostBody> {
    const response = await admin
      .put(apiPath(`/posts/${id}`))
      .send(body)
      .expect(200);
    return response.body as AdminPostBody;
  }

  function withEnglishTitle(title: string) {
    return { translations: [{ ...TRANSLATION_EN, title }] };
  }

  function getPublicPost(postNumber: number | string) {
    return request(e2e.app.getHttpServer()).get(
      apiPath(`/posts/${postNumber}`),
    );
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('однакові заголовки → той самий slug без суфікса, різні номери; новину знаходить номер', async () => {
    const first = await createPost({ status: 'PUBLISHED' });
    const second = await createPost({ status: 'PUBLISHED' });
    expect(first.slug).toBe('arsenal-win-the-derby');
    expect(second.slug).toBe(first.slug);
    expect(second.number).toBeGreaterThan(first.number);

    const detail = await getPublicPost(second.number).expect(200);
    expectMatchesContract(detail, 'get', '/posts/{number}');
    expect(detail.body).toMatchObject({
      id: second.id,
      number: second.number,
      slug: second.slug,
    });
  });

  it('чернетка, запланована й видалена за номером → 404', async () => {
    const draft = await createPost({});
    const scheduled = await createPost({
      status: 'SCHEDULED',
      publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
    });
    const deleted = await createPost({ status: 'PUBLISHED' });
    await admin.delete(apiPath(`/posts/${deleted.id}`)).expect(200);

    for (const post of [draft, scheduled, deleted]) {
      const response = await getPublicPost(post.number).expect(404);
      expect(response.body).toMatchObject({ message: 'POST_NOT_FOUND' });
    }
  });

  it.each(['abc', '0', '-1', '1.5', '2147483648', '1775675859414'])(
    'номер %j → 400, а не 500',
    async (invalidNumber) => {
      const response = await getPublicPost(invalidNumber).expect(400);
      expectMatchesContract(response, 'get', '/posts/{number}');
    },
  );

  it('без дати публікації slug іде за EN-заголовком; з датою — зафіксований', async () => {
    const post = await createPost({});
    const retitled = await updatePost(
      post.id,
      withEnglishTitle('Chelsea hold Arsenal'),
    );
    expect(retitled.slug).toBe('chelsea-hold-arsenal');

    // Публікація й новий заголовок одним запитом — slug нового заголовка
    const published = await updatePost(post.id, {
      status: 'PUBLISHED',
      ...withEnglishTitle('Arsenal and Chelsea draw'),
    });
    expect(published.slug).toBe('arsenal-and-chelsea-draw');

    const retitledAfterPublishing = await updatePost(
      post.id,
      withEnglishTitle('Derby ends level'),
    );
    expect(retitledAfterPublishing.slug).toBe('arsenal-and-chelsea-draw');

    const scheduled = await createPost({
      status: 'SCHEDULED',
      publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
    });
    const retitledScheduled = await updatePost(
      scheduled.id,
      withEnglishTitle('Derby moved to Sunday'),
    );
    expect(retitledScheduled.slug).toBe(scheduled.slug);
  });

  it('знята в чернетку (дата зникає) → slug знову йде за заголовком, номер той самий', async () => {
    const post = await createPost({ status: 'PUBLISHED' });
    await updatePost(post.id, { status: 'DRAFT' });
    const retitled = await updatePost(
      post.id,
      withEnglishTitle('Derby report corrected'),
    );
    expect(retitled).toMatchObject({
      slug: 'derby-report-corrected',
      number: post.number,
    });
  });

  it('явний slug з адмінки: при створенні й у опублікованій новині', async () => {
    const post = await createPost({ status: 'PUBLISHED', slug: 'derby-2026' });
    expect(post.slug).toBe('derby-2026');

    const renamed = await updatePost(post.id, { slug: 'north-london-derby' });
    expect(renamed).toMatchObject({
      slug: 'north-london-derby',
      number: post.number,
    });
    const detail = await getPublicPost(post.number).expect(200);
    expect(detail.body).toMatchObject({ slug: 'north-london-derby' });
  });

  it.each(['Derby Day', 'derby--day', '-derby', 'дербі', 'a'.repeat(81), null])(
    'невалідний slug %j → 400',
    async (slug) => {
      await admin
        .post(apiPath('/posts'))
        .send({ translations: [TRANSLATION_EN], slug })
        .expect(400);
    },
  );
});
