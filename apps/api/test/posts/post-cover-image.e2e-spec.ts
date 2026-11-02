import {
  POST_COVER_IMAGE_ALT_MAX_LENGTH,
  POST_COVER_IMAGE_CREDIT_MAX_LENGTH,
} from '@football-portal/validation';
import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

// Обкладинка — лише з фотобанку зі списку (M1.8.3a)
const COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=630&fit=crop&q=80';
const COVER_IMAGE_CREDIT = 'Stuart MacFarlane / Getty Images';
const ALT_EN = 'Arsenal players celebrate the winning goal';
const ALT_UK = 'Гравці «Арсенала» святкують переможний гол';
const OTHER_COVER_IMAGE_URL =
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg';
/** Фото з чужого сайту — як у новин, збережених до M1.8.3a */
const FOREIGN_COVER_IMAGE_URL = 'https://e2e.test/news/derby-cover.jpg';
const OTHER_ALT_EN = 'Empty stands of the stadium before kick-off';

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

describe('Обкладинка новини: фотобанк, опис для незрячих і підпис автора фото (D44, M1.8.3a)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let post: CreatedPostBody;

  /** Як зараз збережено обкладинку: підпис на пості й опис кожного перекладу. */
  async function storedCoverImage(postId: string) {
    return e2e.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: {
        coverImageUrl: true,
        coverImageCredit: true,
        translations: {
          select: { languageCode: true, coverImageAlt: true },
          orderBy: { languageCode: 'asc' },
        },
      },
    });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('опублікована з обкладинкою без опису українською чи без підпису → 400, новину не створено', async () => {
    const withoutUkAlt = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        coverImageUrl: COVER_IMAGE_URL,
        coverImageCredit: COVER_IMAGE_CREDIT,
        translations: [{ ...DERBY_EN, coverImageAlt: ALT_EN }, DERBY_UK],
      })
      .expect(400);
    expectMatchesContract(withoutUkAlt, 'post', '/posts');
    expect(withoutUkAlt.body).toMatchObject({
      message: 'COVER_IMAGE_ALT_REQUIRED',
    });

    const withoutCredit = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        coverImageUrl: COVER_IMAGE_URL,
        translations: [
          { ...DERBY_EN, coverImageAlt: ALT_EN },
          { ...DERBY_UK, coverImageAlt: ALT_UK },
        ],
      })
      .expect(400);
    expect(withoutCredit.body).toMatchObject({
      message: 'COVER_IMAGE_CREDIT_REQUIRED',
    });
    expect(await e2e.prisma.post.count()).toBe(0);
  });

  it('чернетка може бути неповною; опублікувати — лише з описом кожною мовою й підписом; сайт віддає опис мовою сторінки', async () => {
    const draft = await admin
      .post(apiPath('/posts'))
      .send({
        coverImageUrl: COVER_IMAGE_URL,
        translations: [DERBY_EN, DERBY_UK],
      })
      .expect(201);
    post = draft.body as CreatedPostBody;

    // Опис українською — лише в перекладі, якого немає в запиті: правило дивиться на всю новину
    const withoutUkAlt = await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({
        status: 'PUBLISHED',
        coverImageCredit: COVER_IMAGE_CREDIT,
        translations: [{ ...DERBY_EN, coverImageAlt: ALT_EN }],
      })
      .expect(400);
    expectMatchesContract(withoutUkAlt, 'put', '/posts/{id}');
    expect(withoutUkAlt.body).toMatchObject({
      message: 'COVER_IMAGE_ALT_REQUIRED',
    });

    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({
        status: 'PUBLISHED',
        coverImageCredit: COVER_IMAGE_CREDIT,
        translations: [
          { ...DERBY_EN, coverImageAlt: ALT_EN },
          { ...DERBY_UK, coverImageAlt: ALT_UK },
        ],
      })
      .expect(200);

    const ukDetail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(ukDetail, 'get', '/posts/{number}');
    expect(ukDetail.body).toMatchObject({
      coverImageUrl: COVER_IMAGE_URL,
      coverImageAlt: ALT_UK,
      coverImageCredit: COVER_IMAGE_CREDIT,
    });

    const enList = await request(e2e.app.getHttpServer())
      .get(apiPath('/posts'))
      .query({ lang: 'en' })
      .expect(200);
    expectMatchesContract(enList, 'get', '/posts');
    expect(enList.body).toMatchObject({
      data: [{ id: post.id, coverImageAlt: ALT_EN }],
    });
  });

  it('правка заголовка без опису й підпису в запиті їх не стирає', async () => {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({
        translations: [
          { ...DERBY_EN, title: 'Arsenal edge Chelsea in the derby' },
        ],
      })
      .expect(200);

    expect(await storedCoverImage(post.id)).toEqual({
      coverImageUrl: COVER_IMAGE_URL,
      coverImageCredit: COVER_IMAGE_CREDIT,
      translations: [
        { languageCode: 'en', coverImageAlt: ALT_EN },
        { languageCode: 'uk', coverImageAlt: ALT_UK },
      ],
    });
  });

  it('інше фото старих опису й підпису не успадковує: опублікована без нових → 400, у чернетці лишаються лише передані', async () => {
    const publishedWithoutTexts = await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ coverImageUrl: OTHER_COVER_IMAGE_URL })
      .expect(400);
    expect(publishedWithoutTexts.body).toMatchObject({
      message: 'COVER_IMAGE_ALT_REQUIRED',
    });

    const draft = await admin
      .post(apiPath('/posts'))
      .send({
        coverImageUrl: COVER_IMAGE_URL,
        coverImageCredit: COVER_IMAGE_CREDIT,
        translations: [
          { ...DERBY_EN, coverImageAlt: ALT_EN },
          { ...DERBY_UK, coverImageAlt: ALT_UK },
        ],
      })
      .expect(201);
    const draftId = (draft.body as CreatedPostBody).id;
    // Новий опис — лише англійською; підпис не передано
    await admin
      .put(apiPath(`/posts/${draftId}`))
      .send({
        coverImageUrl: OTHER_COVER_IMAGE_URL,
        translations: [{ ...DERBY_EN, coverImageAlt: OTHER_ALT_EN }],
      })
      .expect(200);

    expect(await storedCoverImage(draftId)).toEqual({
      coverImageUrl: OTHER_COVER_IMAGE_URL,
      coverImageCredit: null,
      translations: [
        { languageCode: 'en', coverImageAlt: OTHER_ALT_EN },
        { languageCode: 'uk', coverImageAlt: null },
      ],
    });
  });

  it('обкладинку прибрано → опис у всіх перекладах і підпис очищено', async () => {
    await admin
      .put(apiPath(`/posts/${post.id}`))
      .send({ coverImageUrl: null })
      .expect(200);

    expect(await storedCoverImage(post.id)).toEqual({
      coverImageUrl: null,
      coverImageCredit: null,
      translations: [
        { languageCode: 'en', coverImageAlt: null },
        { languageCode: 'uk', coverImageAlt: null },
      ],
    });
    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .expect(200);
    expect(detail.body).toMatchObject({
      coverImageUrl: null,
      coverImageAlt: null,
      coverImageCredit: null,
    });
  });

  it('нова обкладинка не з фотобанку зі списку → 400 COVER_IMAGE_HOST_NOT_ALLOWED, і в чернетці', async () => {
    const postsBefore = await e2e.prisma.post.count();
    const response = await admin
      .post(apiPath('/posts'))
      .send({
        coverImageUrl: FOREIGN_COVER_IMAGE_URL,
        translations: [DERBY_EN],
      })
      .expect(400);
    expectMatchesContract(response, 'post', '/posts');
    expect(response.body).toMatchObject({
      message: 'COVER_IMAGE_HOST_NOT_ALLOWED',
    });
    expect(await e2e.prisma.post.count()).toBe(postsBefore);
  });

  it('збережена обкладинка з чужого сайту: новина редагується без зміни фото, інше чуже фото → 400', async () => {
    const created = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        coverImageUrl: COVER_IMAGE_URL,
        coverImageCredit: COVER_IMAGE_CREDIT,
        translations: [
          { ...DERBY_EN, coverImageAlt: ALT_EN },
          { ...DERBY_UK, coverImageAlt: ALT_UK },
        ],
      })
      .expect(201);
    const legacyPost = created.body as CreatedPostBody;
    // Новина, збережена до M1.8.3a: фото з будь-якого https-хоста — записом в обхід API
    await e2e.prisma.post.update({
      where: { id: legacyPost.id },
      data: { coverImageUrl: FOREIGN_COVER_IMAGE_URL },
    });

    // Як адмінка: у `PUT` лише змінене (D50) — заголовок, потім підпис фото без адреси
    const titleEdit = await admin
      .put(apiPath(`/posts/${legacyPost.id}`))
      .send({
        translations: [
          { ...DERBY_EN, title: 'Arsenal edge Chelsea in the derby' },
        ],
      })
      .expect(200);
    expectMatchesContract(titleEdit, 'put', '/posts/{id}');
    await admin
      .put(apiPath(`/posts/${legacyPost.id}`))
      .send({ coverImageCredit: 'Getty Images' })
      .expect(200);
    // Клієнт, що надсилає адресу без змін, — те саме фото
    await admin
      .put(apiPath(`/posts/${legacyPost.id}`))
      .send({ coverImageUrl: FOREIGN_COVER_IMAGE_URL })
      .expect(200);

    const otherForeign = await admin
      .put(apiPath(`/posts/${legacyPost.id}`))
      .send({ coverImageUrl: 'https://e2e.test/news/stadium.jpg' })
      .expect(400);
    expectMatchesContract(otherForeign, 'put', '/posts/{id}');
    expect(otherForeign.body).toMatchObject({
      message: 'COVER_IMAGE_HOST_NOT_ALLOWED',
    });

    expect(await storedCoverImage(legacyPost.id)).toEqual({
      coverImageUrl: FOREIGN_COVER_IMAGE_URL,
      coverImageCredit: 'Getty Images',
      translations: [
        { languageCode: 'en', coverImageAlt: ALT_EN },
        { languageCode: 'uk', coverImageAlt: ALT_UK },
      ],
    });
    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${legacyPost.number}`))
      .expect(200);
    expect(detail.body).toMatchObject({
      title: 'Arsenal edge Chelsea in the derby',
      coverImageUrl: FOREIGN_COVER_IMAGE_URL,
    });
  });

  it('опис і підпис довші за спільні межі (packages/validation) → 400', async () => {
    const response = await admin
      .post(apiPath('/posts'))
      .send({
        coverImageUrl: COVER_IMAGE_URL,
        coverImageCredit: 'c'.repeat(POST_COVER_IMAGE_CREDIT_MAX_LENGTH + 1),
        translations: [
          {
            ...DERBY_EN,
            coverImageAlt: 'a'.repeat(POST_COVER_IMAGE_ALT_MAX_LENGTH + 1),
          },
        ],
      })
      .expect(400);
    expectMatchesContract(response, 'post', '/posts');
    const { message } = response.body as { message: string[] };
    expect(message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/coverImageCredit/),
        expect.stringMatching(/coverImageAlt/),
      ]),
    );
  });
});
