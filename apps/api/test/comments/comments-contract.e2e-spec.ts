import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import { postComment } from '../support/e2e-comments';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

/**
 * Старе дерево `GET /comments/post/{postId}` / `…/match/{matchId}` живе до M1.7.3 (D27): на даних з одного рівня
 * воно дає два рівні, і поточний сайт працює. Відповіді — за `packages/types/openapi.json` (D28).
 */
describe('Коментарі: старе дерево й помилки за контрактом OpenAPI', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let author: request.Agent;
  let postId: string;
  let matchId: string;

  function server() {
    return request(e2e.app.getHttpServer());
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

  it('новина: відповідь на відповідь — у дереві на другому рівні; відповіді видаленого кореня — серед коренів', async () => {
    const root = await postComment(author, { content: 'Great match!', postId });
    const reply = await postComment(admin, {
      content: 'Agreed',
      postId,
      parentId: root.id,
    });
    const replyToReply = await postComment(author, {
      content: 'Thanks',
      postId,
      parentId: reply.id,
    });

    const tree = await server()
      .get(apiPath(`/comments/post/${postId}`))
      .expect(200);
    expectMatchesContract(tree, 'get', '/comments/post/{postId}');
    expect(tree.body).toMatchObject([
      {
        id: root.id,
        replies: [
          { id: reply.id, replies: [] },
          { id: replyToReply.id, replies: [] },
        ],
      },
    ]);

    await author.delete(apiPath(`/comments/${root.id}`)).expect(200);
    const orphans = await server()
      .get(apiPath(`/comments/post/${postId}`))
      .expect(200);
    expect(
      (orphans.body as { id: string }[]).map((comment) => comment.id).sort(),
    ).toEqual([reply.id, replyToReply.id].sort());
  });

  it('матч: дерево', async () => {
    const root = await postComment(author, { content: 'What a goal', matchId });
    await postComment(admin, {
      content: 'Top corner',
      matchId,
      parentId: root.id,
    });

    const tree = await server()
      .get(apiPath(`/comments/match/${matchId}`))
      .expect(200);
    expectMatchesContract(tree, 'get', '/comments/match/{matchId}');
    expect(tree.body).toMatchObject([{ id: root.id, replies: [{}] }]);
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

    const adminComment = await postComment(admin, {
      content: 'Pinned?',
      postId,
    });
    const foreign = await author
      .delete(apiPath(`/comments/${adminComment.id}`))
      .expect(403);
    expectMatchesContract(foreign, 'delete', '/comments/{id}');
  });
});
