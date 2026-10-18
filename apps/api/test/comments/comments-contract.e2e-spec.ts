import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

interface CommentBody {
  id: string;
  replies: CommentBody[];
}

/** Відповіді коментарів — за `packages/types/openapi.json` (D28). */
describe('Коментарі: відповіді за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let author: request.Agent;
  let postId: string;
  let matchId: string;

  function server() {
    return request(e2e.app.getHttpServer());
  }

  async function comment(
    agent: request.Agent,
    body: Record<string, string>,
  ): Promise<CommentBody> {
    const response = await agent
      .post(apiPath('/comments'))
      .send(body)
      .expect(201);
    expectMatchesContract(response, 'post', '/comments');
    return response.body as CommentBody;
  }

  beforeAll(async () => {
    // Без паузи між коментарями: тест пише кілька підряд від одного автора
    e2e = await createE2eApp({ envOverrides: { COMMENT_COOLDOWN_MS: '0' } });
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    author = await loginAs(e2e, await createUser(e2e));
    postId = (await publishPost(admin)).id;
    matchId = (await seedFootballLeague(e2e.prisma)).finishedMatchId;
  });
  afterAll(() => e2e.close());

  it('новина: дерево з відповіддю; видалення автором ховає гілку', async () => {
    const root = await comment(author, { content: 'Great match!', postId });
    const reply = await comment(admin, {
      content: 'Agreed',
      postId,
      parentId: root.id,
    });

    const tree = await server()
      .get(apiPath(`/comments/post/${postId}`))
      .expect(200);
    expectMatchesContract(tree, 'get', '/comments/post/{postId}');
    expect(tree.body).toMatchObject([
      { id: root.id, replies: [{ id: reply.id, replies: [] }] },
    ]);

    const deleted = await author
      .delete(apiPath(`/comments/${root.id}`))
      .expect(200);
    expectMatchesContract(deleted, 'delete', '/comments/{id}');
    expect(deleted.body).toEqual({ id: root.id, deletedCount: 2 });
  });

  it('матч: дерево; адмін видаляє фізично коментар і гілку', async () => {
    const root = await comment(author, { content: 'What a goal', matchId });
    const reply = await comment(author, {
      content: 'Top corner',
      matchId,
      parentId: root.id,
    });

    const tree = await server()
      .get(apiPath(`/comments/match/${matchId}`))
      .expect(200);
    expectMatchesContract(tree, 'get', '/comments/match/{matchId}');

    const blocked = await admin
      .delete(apiPath(`/comments/${root.id}/purge`))
      .expect(409);
    expectMatchesContract(blocked, 'delete', '/comments/{id}/purge');

    const purged = await admin
      .delete(apiPath(`/comments/${reply.id}/purge`))
      .expect(200);
    expectMatchesContract(purged, 'delete', '/comments/{id}/purge');

    const purgedThread = await admin
      .delete(apiPath(`/comments/${root.id}/purge-thread`))
      .expect(200);
    expectMatchesContract(
      purgedThread,
      'delete',
      '/comments/{id}/purge-thread',
    );
    expect(purgedThread.body).toEqual({ id: root.id, purgedCount: 1 });
  });

  it('помилки — за контрактом: дві цілі, невідома новина, чужий коментар', async () => {
    const twoTargets = await author
      .post(apiPath('/comments'))
      .send({ content: 'Both targets', postId, matchId })
      .expect(400);
    expectMatchesContract(twoTargets, 'post', '/comments');

    const missingPost = await server()
      .get(apiPath('/comments/post/missing-post'))
      .expect(404);
    expectMatchesContract(missingPost, 'get', '/comments/post/{postId}');

    const adminComment = await comment(admin, { content: 'Pinned?', postId });
    const foreign = await author
      .delete(apiPath(`/comments/${adminComment.id}`))
      .expect(403);
    expectMatchesContract(foreign, 'delete', '/comments/{id}');
  });
});
