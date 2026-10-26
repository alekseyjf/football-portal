import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const VIDEO_ID = 'dQw4w9WgXcQ';
const OTHER_VIDEO_ID = 'aqz-KE-bpKQ';
const canonicalUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

const DERBY_EN = {
  languageCode: 'en',
  title: 'Watch: the derby in ten minutes',
  excerpt: 'All the goals and chances from the London derby.',
  content: 'Highlights of the London derby are under the cover image.',
};

interface PostBody {
  id: string;
  number: number;
}

describe('Відео новини: лише YouTube, зберігається канонічним (D54)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let post: PostBody;

  function storedVideoUrl(postId: string) {
    return e2e.prisma.post
      .findUniqueOrThrow({ where: { id: postId }, select: { videoUrl: true } })
      .then((row) => row.videoUrl);
  }

  function updateVideo(videoUrl: unknown) {
    return admin.put(apiPath(`/posts/${post.id}`)).send({ videoUrl });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
  });
  afterAll(() => e2e.close());

  it('посилання youtu.be з параметрами → у новині канонічне, і сайт отримує його ж', async () => {
    const created = await admin
      .post(apiPath('/posts'))
      .send({
        status: 'PUBLISHED',
        translations: [DERBY_EN],
        videoUrl: `  https://youtu.be/${VIDEO_ID}?si=AbCdEf123&t=42  `,
      })
      .expect(201);
    expectMatchesContract(created, 'post', '/posts');
    post = created.body as PostBody;
    expect(await storedVideoUrl(post.id)).toBe(canonicalUrl(VIDEO_ID));

    // Форма адмінки отримує збережене — і після збереження покаже канонічне
    const adminDetail = await admin
      .get(apiPath(`/posts/admin/${post.id}`))
      .expect(200);
    expectMatchesContract(adminDetail, 'get', '/posts/admin/{id}');
    expect(adminDetail.body).toMatchObject({
      videoUrl: canonicalUrl(VIDEO_ID),
    });

    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .expect(200);
    expectMatchesContract(detail, 'get', '/posts/{number}');
    expect(detail.body).toMatchObject({ videoUrl: canonicalUrl(VIDEO_ID) });
  });

  it.each([
    `https://www.youtube.com/shorts/${OTHER_VIDEO_ID}`,
    `https://www.youtube.com/embed/${OTHER_VIDEO_ID}?start=10`,
    `https://m.youtube.com/watch?v=${OTHER_VIDEO_ID}&list=PL1`,
  ])('%s → канонічне посилання', async (videoUrl) => {
    await updateVideo(videoUrl).expect(200);
    expect(await storedVideoUrl(post.id)).toBe(canonicalUrl(OTHER_VIDEO_ID));
  });

  it.each([
    'https://vimeo.com/123456789',
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    'https://www.youtube.com/@premierleague',
    `https://youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    'https://youtu.be/short',
    `javascript:alert('${VIDEO_ID}')`,
    '',
    42,
  ])(
    'не відео YouTube (%j) → 400, збережене не змінилось',
    async (videoUrl) => {
      const before = await storedVideoUrl(post.id);
      const response = await updateVideo(videoUrl).expect(400);
      expectMatchesContract(response, 'put', '/posts/{id}');
      expect(await storedVideoUrl(post.id)).toBe(before);
    },
  );

  it('null прибирає відео', async () => {
    const response = await updateVideo(null).expect(200);
    expectMatchesContract(response, 'put', '/posts/{id}');
    expect(await storedVideoUrl(post.id)).toBeNull();

    const detail = await request(e2e.app.getHttpServer())
      .get(apiPath(`/posts/${post.number}`))
      .expect(200);
    expect(detail.body).toMatchObject({ videoUrl: null });
  });
});
