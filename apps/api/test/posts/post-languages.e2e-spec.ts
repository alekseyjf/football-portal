import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';

interface TranslationInput {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
}

interface PostSummaryBody {
  slug: string;
  title: string;
  resolvedLanguage: string;
}

const DERBY_EN: TranslationInput = {
  languageCode: 'en',
  title: 'Derby ends in a late draw',
  excerpt: 'An equaliser in stoppage time kept the derby level.',
  content:
    'The visitors equalised in the 94th minute after a long spell of pressure.',
};
const DERBY_UK: TranslationInput = {
  languageCode: 'uk',
  title: 'Дербі завершилось пізньою нічиєю',
  excerpt: 'Гол у компенсований час зберіг рівновагу в дербі.',
  content: 'Гості зрівняли рахунок на 94-й хвилині після довгого тиску.',
};
const TRANSFER_EN: TranslationInput = {
  languageCode: 'en',
  title: 'Midfielder signs a new contract',
  excerpt: 'The club extended the deal of its captain until 2029.',
  content:
    'The new contract runs until the summer of 2029, the club announced.',
};

/** Пост публікує адмін через API — так, як адмінка. */
async function publishPost(
  admin: request.Agent,
  translations: TranslationInput[],
): Promise<string> {
  const response = await admin
    .post(apiPath('/posts'))
    .send({ status: 'PUBLISHED', translations })
    .expect(201);
  return (response.body as { slug: string }).slug;
}

describe('Мова контенту постів (?lang, D22 / D23)', () => {
  let e2e: E2eApp;
  let derbySlug: string;
  let transferSlug: string;

  async function listPosts(
    lang: string,
  ): Promise<Map<string, PostSummaryBody>> {
    const response = await request(e2e.app.getHttpServer())
      .get(apiPath('/posts'))
      .query({ lang })
      .expect(200);
    const { data } = response.body as { data: PostSummaryBody[] };
    return new Map(data.map((post) => [post.slug, post]));
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    const admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    derbySlug = await publishPost(admin, [DERBY_EN, DERBY_UK]);
    transferSlug = await publishPost(admin, [TRANSFER_EN]);
  });
  afterAll(() => e2e.close());

  it('?lang=uk → український переклад; пост без нього — англійською з resolvedLanguage en', async () => {
    const posts = await listPosts('uk');
    expect(posts.get(derbySlug)).toMatchObject({
      title: DERBY_UK.title,
      resolvedLanguage: 'uk',
    });
    expect(posts.get(transferSlug)).toMatchObject({
      title: TRANSFER_EN.title,
      resolvedLanguage: 'en',
    });
  });

  it('?lang=ua (старий код української) → default-мова, а не 400', async () => {
    const posts = await listPosts('ua');
    expect(posts.get(derbySlug)).toMatchObject({
      title: DERBY_EN.title,
      resolvedLanguage: 'en',
    });
  });

  it('пост ?lang=uk → український текст і обидві мови в availableLanguages', async () => {
    const response = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${derbySlug}`))
      .query({ lang: 'uk' })
      .expect(200);
    const post = response.body as PostSummaryBody & {
      content: string;
      availableLanguages: string[];
    };
    expect(post).toMatchObject({
      title: DERBY_UK.title,
      content: DERBY_UK.content,
      resolvedLanguage: 'uk',
    });
    expect([...post.availableLanguages].sort()).toEqual(['en', 'uk']);
  });
});
