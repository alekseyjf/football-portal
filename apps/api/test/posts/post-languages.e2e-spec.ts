import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

interface TranslationInput {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
}

interface PostSummaryBody {
  number: number;
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

/** Мова є в `Language`, але вимкнена (`isActive: false`) — переклад нею не зберігається (P3-3). */
const DISABLED_LANGUAGE = {
  code: 'es',
  name: 'Español',
  isActive: false,
  sortOrder: 3,
};
const TRANSFER_ES: TranslationInput = {
  languageCode: DISABLED_LANGUAGE.code,
  title: 'El centrocampista renueva su contrato',
  excerpt: 'El club amplió el contrato de su capitán hasta 2029.',
  content:
    'El nuevo contrato se extiende hasta el verano de 2029, anunció el club.',
};

interface CreatedPostBody {
  id: string;
  number: number;
}

/** Пост публікує адмін через API — так, як адмінка. */
async function publishPost(
  admin: request.Agent,
  translations: TranslationInput[],
): Promise<CreatedPostBody> {
  const response = await admin
    .post(apiPath('/posts'))
    .send({ status: 'PUBLISHED', translations })
    .expect(201);
  return response.body as CreatedPostBody;
}

describe('Мови контенту постів: читання (?lang) і переклади (D22 / D23)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let derbyNumber: number;
  let transferPost: CreatedPostBody;

  async function listPosts(
    lang: string,
  ): Promise<Map<number, PostSummaryBody>> {
    const response = await request(e2e.app.getHttpServer())
      .get(apiPath('/posts'))
      .query({ lang })
      .expect(200);
    const { data } = response.body as { data: PostSummaryBody[] };
    return new Map(data.map((post) => [post.number, post]));
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    // До першого запиту, що читає мови: LanguageService кешує їх на 60 с
    await e2e.prisma.language.create({ data: DISABLED_LANGUAGE });
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    derbyNumber = (await publishPost(admin, [DERBY_EN, DERBY_UK])).number;
    transferPost = await publishPost(admin, [TRANSFER_EN]);
  });
  afterAll(() => e2e.close());

  it('?lang=uk → український переклад; пост без нього — англійською з resolvedLanguage en', async () => {
    const posts = await listPosts('uk');
    expect(posts.get(derbyNumber)).toMatchObject({
      title: DERBY_UK.title,
      resolvedLanguage: 'uk',
    });
    expect(posts.get(transferPost.number)).toMatchObject({
      title: TRANSFER_EN.title,
      resolvedLanguage: 'en',
    });
  });

  it('?lang=ua (старий код української) → default-мова, а не 400', async () => {
    const posts = await listPosts('ua');
    expect(posts.get(derbyNumber)).toMatchObject({
      title: DERBY_EN.title,
      resolvedLanguage: 'en',
    });
  });

  it('пост ?lang=uk → український текст, slug з EN-заголовка й обидві мови в availableLanguages', async () => {
    const response = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${derbyNumber}`))
      .query({ lang: 'uk' })
      .expect(200);
    const post = response.body as PostSummaryBody & {
      content: string;
      availableLanguages: string[];
    };
    // Slug один на всі мови — мову задає локаль в URL (D24)
    expect(post).toMatchObject({
      title: DERBY_UK.title,
      content: DERBY_UK.content,
      resolvedLanguage: 'uk',
      slug: 'derby-ends-in-a-late-draw',
    });
    expect([...post.availableLanguages].sort()).toEqual(['en', 'uk']);
  });

  it('новий пост без перекладу default-мови (лише UK) → 400 DEFAULT_TRANSLATION_REQUIRED', async () => {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ status: 'PUBLISHED', translations: [DERBY_UK] })
      .expect(400);
    expectMatchesContract(response, 'post', '/posts');
    expect(response.body).toMatchObject({
      message: 'DEFAULT_TRANSLATION_REQUIRED',
    });
  });

  it('переклад вимкненою мовою → 400 UNSUPPORTED_LANGUAGE і при створенні, і при оновленні', async () => {
    const created = await admin
      .post(apiPath('/posts'))
      .send({ translations: [TRANSFER_EN, TRANSFER_ES] })
      .expect(400);
    expectMatchesContract(created, 'post', '/posts');
    expect(created.body).toMatchObject({ message: 'UNSUPPORTED_LANGUAGE' });

    const updated = await admin
      .put(apiPath(`/posts/${transferPost.id}`))
      .send({ translations: [TRANSFER_ES] })
      .expect(400);
    expectMatchesContract(updated, 'put', '/posts/{id}');
    expect(updated.body).toMatchObject({ message: 'UNSUPPORTED_LANGUAGE' });
    // Рядок мови в `Language` є, тож FK переклад пропустив би — не пускає саме правило мов
    const storedTranslations = await e2e.prisma.postTranslation.findMany({
      where: { postId: transferPost.id },
      select: { languageCode: true },
    });
    expect(storedTranslations).toEqual([{ languageCode: 'en' }]);
  });
});
