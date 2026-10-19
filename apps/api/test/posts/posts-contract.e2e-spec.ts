import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const TRANSLATION_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
};
const TRANSLATION_UK = {
  languageCode: 'uk',
  title: 'Арсенал виграв дербі',
  excerpt: 'Пізній гол вирішив напружене лондонське дербі.',
  content: 'Господарі забили в компенсований час і взяли три очки.',
};

interface CreatedPost {
  id: string;
  number: number;
}

/** Відповіді постів — за `packages/types/openapi.json`: з нього типи web і адмінки (D28). */
describe('Пости: відповіді за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let post: CreatedPost;

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));

    const league = await seedFootballLeague(e2e.prisma);
    const tag = await e2e.prisma.tag.create({
      data: {
        slug: 'derby',
        translations: {
          create: [
            { languageCode: 'en', name: 'Derby' },
            { languageCode: 'uk', name: 'Дербі' },
          ],
        },
      },
    });
    const created = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        translations: [TRANSLATION_EN, TRANSLATION_UK],
        coverImageUrl: 'https://e2e.test/cover.jpg',
        videoUrl: 'https://e2e.test/video',
        sourceUrl: 'https://e2e.test/source',
        tagIds: [tag.id],
        clubIds: [league.homeClubId],
        competitionIds: [league.competitionId],
      })
      .expect(201);
    expectMatchesContract(created, 'post', '/posts');
    post = created.body as CreatedPost;
  });
  afterAll(() => e2e.close());

  it('стрічка й новина — з тегом, турніром, клубом і автором', async () => {
    const server = request(e2e.app.getHttpServer());
    const list = await server
      .get(apiPath('/posts'))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(list, 'get', '/posts');
    expect(list.body).toMatchObject({ total: 1, data: [{ id: post.id }] });

    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(detail, 'get', '/posts/{number}');
    expect(detail.body).toMatchObject({
      resolvedLanguage: 'uk',
      tags: [{ slug: 'derby', name: 'Дербі' }],
      competitions: [{ slug: 'PL' }],
      clubs: [{ slug: 'arsenal' }],
    });

    const missing = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number + 1}`))
      .expect(404);
    expectMatchesContract(missing, 'get', '/posts/{number}');
  });

  it('адмінка: список, зміна, помилка валідації, видалення', async () => {
    const adminList = await admin.get(apiPath('/posts/admin/all')).expect(200);
    expectMatchesContract(adminList, 'get', '/posts/admin/all');

    const updated = await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ status: 'DRAFT', coverImageUrl: null, slug: 'london-derby' })
      .expect(200);
    expectMatchesContract(updated, 'put', '/posts/{id}');
    expect(updated.body).toMatchObject({
      status: 'DRAFT',
      publishedAt: null,
      slug: 'london-derby',
    });

    const invalid = await admin
      .post(apiPath('/posts'))
      .send({ translations: [{ ...TRANSLATION_EN, title: '' }] })
      .expect(400);
    expectMatchesContract(invalid, 'post', '/posts');

    const deleted = await admin
      .delete(apiPath(`/posts/${post.id}`))
      .expect(200);
    expectMatchesContract(deleted, 'delete', '/posts/{id}');
    expect(deleted.body).toEqual({ id: post.id });
  });
});
