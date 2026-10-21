import { POST_SOURCE_NAME_MAX_LENGTH } from '@football-portal/validation';
import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const SOURCE_URL = 'https://www.bbc.com/sport/football/articles/derby';
const SOURCE_NAME = 'BBC Sport';
const OTHER_SOURCE_URL = 'https://www.nytimes.com/athletic/football/derby';
const OTHER_SOURCE_NAME = 'The Athletic';

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
}

describe('Джерело новини: адреса й назва, одне на новину (D26)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let post: CreatedPostBody;

  /** Як зараз збережено джерело. */
  function storedSource(postId: string) {
    return e2e.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: { sourceUrl: true, sourceName: true },
    });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('назва без адреси → 400 SOURCE_URL_REQUIRED, новину не створено', async () => {
    const response = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        sourceName: SOURCE_NAME,
        translations: [DERBY_EN],
      })
      .expect(400);
    expectMatchesContract(response, 'post', '/posts');
    expect(response.body).toMatchObject({ message: 'SOURCE_URL_REQUIRED' });
    expect(await e2e.prisma.post.count()).toBe(0);
  });

  it('новина з адресою й назвою джерела: сайт отримує обидві в новині кожною мовою', async () => {
    const created = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        sourceUrl: SOURCE_URL,
        sourceName: SOURCE_NAME,
        translations: [DERBY_EN, DERBY_UK],
      })
      .expect(201);
    post = created.body as CreatedPostBody;

    for (const lang of ['en', 'uk']) {
      const detail = await request(e2e.app.getHttpServer())
        .get(apiPath(`/posts/${post.number}`))
        .query({ lang })
        .expect(200);
      expectMatchesContract(detail, 'get', '/posts/{number}');
      expect(detail.body).toMatchObject({
        resolvedLanguage: lang,
        sourceUrl: SOURCE_URL,
        sourceName: SOURCE_NAME,
      });
    }
    const list = await request(e2e.app.getHttpServer())
      .get(apiPath('/posts'))
      .expect(200);
    expectMatchesContract(list, 'get', '/posts');
  });

  it('правка без полів джерела його не змінює', async () => {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({
        translations: [
          { ...DERBY_EN, title: 'Arsenal edge Chelsea in the derby' },
        ],
      })
      .expect(200);

    expect(await storedSource(post.id)).toEqual({
      sourceUrl: SOURCE_URL,
      sourceName: SOURCE_NAME,
    });
  });

  it('та сама адреса назву лишає, інша — старої назви не переносить (хибне джерело гірше за домен)', async () => {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ sourceUrl: SOURCE_URL })
      .expect(200);
    expect(await storedSource(post.id)).toEqual({
      sourceUrl: SOURCE_URL,
      sourceName: SOURCE_NAME,
    });

    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ sourceUrl: OTHER_SOURCE_URL })
      .expect(200);
    expect(await storedSource(post.id)).toEqual({
      sourceUrl: OTHER_SOURCE_URL,
      sourceName: null,
    });
  });

  it('адресу прибрано → джерело прибрано цілком; назва без адреси в PUT → 400', async () => {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ sourceName: OTHER_SOURCE_NAME })
      .expect(200);
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ sourceUrl: null })
      .expect(200);
    expect(await storedSource(post.id)).toEqual({
      sourceUrl: null,
      sourceName: null,
    });
    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .expect(200);
    expect(detail.body).toMatchObject({ sourceUrl: null, sourceName: null });

    const nameOnly = await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ sourceName: SOURCE_NAME })
      .expect(400);
    expectMatchesContract(nameOnly, 'put', '/posts/{id}');
    expect(nameOnly.body).toMatchObject({ message: 'SOURCE_URL_REQUIRED' });
    expect(await storedSource(post.id)).toEqual({
      sourceUrl: null,
      sourceName: null,
    });
  });

  it('адреса не http(s), порожня чи задовга назва (межа — packages/validation) → 400', async () => {
    const badUrlLongName = await admin
      .post(apiPath('/posts'))
      .send({
        sourceUrl: 'javascript:alert(1)',
        sourceName: 'n'.repeat(POST_SOURCE_NAME_MAX_LENGTH + 1),
        translations: [DERBY_EN],
      })
      .expect(400);
    expectMatchesContract(badUrlLongName, 'post', '/posts');
    const { message } = badUrlLongName.body as { message: string[] };
    expect(message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sourceUrl/),
        expect.stringMatching(/sourceName/),
      ]),
    );

    const ftpUrlBlankName = await admin
      .post(apiPath('/posts'))
      .send({
        sourceUrl: 'ftp://files.example.test/derby.txt',
        sourceName: '   ',
        translations: [DERBY_EN],
      })
      .expect(400);
    expectMatchesContract(ftpUrlBlankName, 'post', '/posts');
    const ftpMessages = (ftpUrlBlankName.body as { message: string[] }).message;
    expect(ftpMessages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sourceUrl/),
        expect.stringMatching(/sourceName/),
      ]),
    );
    expect(await e2e.prisma.post.count()).toBe(1);
  });
});
