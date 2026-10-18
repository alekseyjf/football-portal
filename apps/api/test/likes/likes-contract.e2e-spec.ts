import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const STATS_PATH = '/likes/stats/{targetType}/{targetId}';

/** Відповіді реакцій — за `packages/types/openapi.json` (D28). */
describe('Лайки: відповіді за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let fan: request.Agent;
  let postId: string;

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    const admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    fan = await loginAs(e2e, await createUser(e2e));
    postId = (await publishPost(admin)).id;
  });
  afterAll(() => e2e.close());

  it('гість — лише лічильник; голос користувача — у статистиці й відповіді перемикання', async () => {
    const guestStats = await request(e2e.app.getHttpServer())
      .get(apiPath(`/likes/stats/post/${postId}`))
      .expect(200);
    expectMatchesContract(guestStats, 'get', STATS_PATH);
    expect(guestStats.body).toEqual({ likesCount: 0, myReaction: null });

    const liked = await fan
      .post(apiPath('/likes'))
      .send({ targetType: 'post', targetId: postId, action: 'LIKE' })
      .expect(201);
    expectMatchesContract(liked, 'post', '/likes');
    expect(liked.body).toEqual({ likesCount: 1, myReaction: 'LIKE' });

    const disliked = await fan
      .post(apiPath('/likes'))
      .send({ targetType: 'post', targetId: postId, action: 'DISLIKE' })
      .expect(201);
    expect(disliked.body).toEqual({ likesCount: 0, myReaction: 'DISLIKE' });

    const fanStats = await fan
      .get(apiPath(`/likes/stats/post/${postId}`))
      .expect(200);
    expectMatchesContract(fanStats, 'get', STATS_PATH);
    expect(fanStats.body).toEqual({ likesCount: 0, myReaction: 'DISLIKE' });
  });

  it('помилки — за контрактом: невідомий тип цілі, неіснуюча ціль, невалідне тіло', async () => {
    const server = e2e.app.getHttpServer();
    const unknownType = await request(server)
      .get(apiPath(`/likes/stats/player/${postId}`))
      .expect(400);
    expectMatchesContract(unknownType, 'get', STATS_PATH);

    const missingTarget = await request(server)
      .get(apiPath('/likes/stats/comment/missing-comment'))
      .expect(404);
    expectMatchesContract(missingTarget, 'get', STATS_PATH);

    const invalidBody = await fan
      .post(apiPath('/likes'))
      .send({ targetType: 'post', targetId: postId, action: 'LOVE' })
      .expect(400);
    expectMatchesContract(invalidBody, 'post', '/likes');
  });
});
