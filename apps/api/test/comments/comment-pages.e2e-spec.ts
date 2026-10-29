import { PostStatus, Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs } from '../support/e2e-auth';
import {
  collectAllIds,
  getRepliesPage,
  getRootsPage,
  postComment,
} from '../support/e2e-comments';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { seedFootballLeague } from '../support/e2e-football';
import { expectMatchesContract } from '../support/openapi-contract';

const NEWEST = 'newest';

/** Порції коренів і відповідей (D27): порядок, курсор, лайки з порцією, межі параметрів. */
describe('Коментарі: порції з курсором і лайками (D27)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let alice: request.Agent;

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  /** Адмін — без анти-абузу: багато коментарів підряд не дають санкції. */
  async function createComments(
    target: Record<string, string>,
    count: number,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const created = await postComment(admin, {
        ...target,
        content: `Comment ${index + 1}`,
      });
      ids.push(created.id);
    }
    return ids;
  }

  /** Порядок з БД: `createdAt`, за рівного часу — `id`. */
  async function idsInDbOrder(
    commentIds: string[],
    direction: 'asc' | 'desc',
  ): Promise<string[]> {
    const comments = await e2e.prisma.comment.findMany({
      where: { id: { in: commentIds } },
      orderBy: [{ createdAt: direction }, { id: direction }],
      select: { id: true },
    });
    return comments.map((comment) => comment.id);
  }

  function allRoots(postId: string, limit: number): Promise<string[]> {
    return collectAllIds((cursor) =>
      getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit,
        ...(cursor ? { cursor } : {}),
      }),
    );
  }

  function allReplies(rootId: string, limit: number): Promise<string[]> {
    return collectAllIds((cursor) =>
      getRepliesPage(guest(), rootId, { limit, ...(cursor ? { cursor } : {}) }),
    );
  }

  beforeAll(async () => {
    e2e = await createE2eApp({ envOverrides: { COMMENT_COOLDOWN_MS: '0' } });
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    alice = await loginAs(e2e, await createUser(e2e));
  });
  afterAll(() => e2e.close());

  describe('порядок і курсор на сталих даних', () => {
    it('корені — нові першими, порціями: без дублів і пропусків, остання — без курсора', async () => {
      const postId = (await publishPost(admin)).id;
      const rootIds = await createComments({ postId }, 7);

      const first = await getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit: 3,
      });
      expect(first.items).toHaveLength(3);
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(await allRoots(postId, 3)).toEqual(
        await idsInDbOrder(rootIds, 'desc'),
      );
      // Ліміт за замовчуванням — 20: сім коренів — одна порція
      const whole = await getRootsPage(guest(), { postId, sort: NEWEST });
      expect(whole.items).toHaveLength(7);
      expect(whole.nextCursor).toBeNull();
    });

    it('відповіді — від старих до нових, порціями; лічильник відповідей — у корені', async () => {
      const postId = (await publishPost(admin)).id;
      const [rootId] = await createComments({ postId }, 1);
      const replyIds = await createComments({ postId, parentId: rootId }, 5);

      expect(await allReplies(rootId, 2)).toEqual(
        await idsInDbOrder(replyIds, 'asc'),
      );
      const roots = await getRootsPage(guest(), { postId, sort: NEWEST });
      expect(roots.items).toEqual([
        expect.objectContaining({ id: rootId, replyCount: 5 }),
      ]);
    });

    it('лічильник — у кожній порції коренів: живі корені й відповіді, відповіді під заглушкою — так, сама заглушка — ні', async () => {
      const postId = (await publishPost(admin)).id;
      const [stubRoot, liveRoot, goneRoot] = await createComments(
        { postId },
        3,
      );
      await createComments({ postId, parentId: stubRoot }, 2);
      const [goneReply] = await createComments(
        { postId, parentId: liveRoot },
        2,
      );
      for (const id of [stubRoot, goneRoot, goneReply]) {
        await admin.delete(apiPath(`/comments/${id}`)).expect(200);
      }

      // Корінь-заглушка з двома відповідями, живий корінь з однією відповіддю
      const first = await getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit: 1,
      });
      const second = await getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit: 1,
        cursor: first.nextCursor as string,
      });
      expect([first.commentCount, second.commentCount]).toEqual([4, 4]);
      const thread = await e2e.prisma.commentThread.findUniqueOrThrow({
        where: { postId },
        select: { commentCount: true },
      });
      expect(thread.commentCount).toBe(4);
    });

    it('однаковий час — порядок за id: курсор не губить і не повторює коментарі однієї мілісекунди', async () => {
      const postId = (await publishPost(admin)).id;
      const rootIds = await createComments({ postId }, 5);
      const replyIds = await createComments(
        { postId, parentId: rootIds[0] },
        5,
      );
      const sameInstant = new Date('2026-10-27T12:00:00.000Z');
      await e2e.prisma.comment.updateMany({
        where: { id: { in: [...rootIds, ...replyIds] } },
        data: { createdAt: sameInstant },
      });

      expect(await allRoots(postId, 2)).toEqual([...rootIds].sort().reverse());
      expect(await allReplies(rootIds[0], 2)).toEqual([...replyIds].sort());
    });
  });

  describe('вставка й видалення між порціями', () => {
    it('корені: новий з’являється нагорі списку, а не в наступній порції; видалені — не повторюють і не зсувають', async () => {
      const postId = (await publishPost(admin)).id;
      const rootIds = await createComments({ postId }, 9);
      const ordered = await idsInDbOrder(rootIds, 'desc');

      const first = await getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit: 4,
      });
      const firstIds = first.items.map((item) => item.id);
      expect(firstIds).toEqual(ordered.slice(0, 4));

      // Між порціями: новий корінь, видалено вже показаний і ще не показаний
      const [freshId] = await createComments({ postId }, 1);
      const seenDeleted = ordered[1];
      const unseenDeleted = ordered[6];
      await admin.delete(apiPath(`/comments/${seenDeleted}`)).expect(200);
      await admin.delete(apiPath(`/comments/${unseenDeleted}`)).expect(200);

      const restIds = await collectAllIds((cursor) =>
        getRootsPage(guest(), {
          postId,
          sort: NEWEST,
          limit: 4,
          cursor: cursor ?? (first.nextCursor as string),
        }),
      );
      expect(restIds).toEqual(
        ordered.slice(4).filter((id) => id !== unseenDeleted),
      );
      expect(new Set([...firstIds, ...restIds]).size).toBe(
        firstIds.length + restIds.length,
      );
      expect(restIds).not.toContain(freshId);
    });

    it('відповіді: нова — у кінці наступних порцій; видалені — не повторюють і не зсувають', async () => {
      const postId = (await publishPost(admin)).id;
      const [rootId] = await createComments({ postId }, 1);
      const replyIds = await createComments({ postId, parentId: rootId }, 7);
      const ordered = await idsInDbOrder(replyIds, 'asc');

      const first = await getRepliesPage(guest(), rootId, { limit: 3 });
      const firstIds = first.items.map((item) => item.id);
      expect(firstIds).toEqual(ordered.slice(0, 3));

      const [freshId] = await createComments({ postId, parentId: rootId }, 1);
      await admin.delete(apiPath(`/comments/${ordered[0]}`)).expect(200);
      await admin.delete(apiPath(`/comments/${ordered[4]}`)).expect(200);

      const restIds = await collectAllIds((cursor) =>
        getRepliesPage(guest(), rootId, {
          limit: 3,
          cursor: cursor ?? (first.nextCursor as string),
        }),
      );
      expect(restIds).toEqual([
        ...ordered.slice(3).filter((id) => id !== ordered[4]),
        freshId,
      ]);
    });
  });

  it('лайки — з порцією: likeCount і мій голос; гість — null', async () => {
    const postId = (await publishPost(admin)).id;
    const [liked, disliked, untouched] = await createComments({ postId }, 3);
    const [likedReply] = await createComments({ postId, parentId: liked }, 1);
    for (const [targetId, action] of [
      [liked, 'LIKE'],
      [disliked, 'DISLIKE'],
      [likedReply, 'LIKE'],
    ] as const) {
      await alice
        .post(apiPath('/likes'))
        .send({ targetType: 'comment', targetId, action })
        .expect(201);
    }

    const mine = await getRootsPage(alice, { postId, sort: NEWEST });
    const byId = new Map(mine.items.map((item) => [item.id, item]));
    expect(byId.get(liked)).toMatchObject({ likeCount: 1, myReaction: 'LIKE' });
    // Дизлайки публічно не показуємо (Rule 17) — лише свій голос
    expect(byId.get(disliked)).toMatchObject({
      likeCount: 0,
      myReaction: 'DISLIKE',
    });
    expect(byId.get(untouched)).toMatchObject({
      likeCount: 0,
      myReaction: null,
    });

    const asGuest = await getRootsPage(guest(), { postId, sort: NEWEST });
    expect(asGuest.items.map((item) => item.myReaction)).toEqual([
      null,
      null,
      null,
    ]);
    const myReplies = await getRepliesPage(alice, liked);
    expect(myReplies.items).toEqual([
      expect.objectContaining({
        id: likedReply,
        likeCount: 1,
        myReaction: 'LIKE',
      }),
    ]);
  });

  describe('ціль і видимість', () => {
    it('матч — порція коренів; невідомий матч → 404', async () => {
      const { finishedMatchId } = await seedFootballLeague(e2e.prisma);
      const rootIds = await createComments({ matchId: finishedMatchId }, 2);
      const roots = await getRootsPage(guest(), {
        matchId: finishedMatchId,
        sort: NEWEST,
      });
      expect(roots.items.map((item) => item.id)).toEqual(
        await idsInDbOrder(rootIds, 'desc'),
      );

      const missing = await guest()
        .get(apiPath('/comments'))
        .query({ matchId: 'missing-match', sort: NEWEST })
        .expect(404);
      expectMatchesContract(missing, 'get', '/comments');
      expect(missing.body).toMatchObject({ message: 'MATCH_NOT_FOUND' });
    });

    it('новина без коментарів — порожня порція; чернетка, видалена чи невідома → 404, і відповіді її коментарів теж', async () => {
      const emptyPostId = (await publishPost(admin)).id;
      expect(
        await getRootsPage(guest(), { postId: emptyPostId, sort: NEWEST }),
      ).toEqual({ items: [], nextCursor: null, commentCount: 0 });

      // Зняли з публікації й видалили вже після коментарів
      const draftPostId = (await publishPost(admin)).id;
      const removedPostId = (await publishPost(admin)).id;
      const [rootId] = await createComments({ postId: removedPostId }, 1);
      await e2e.prisma.post.update({
        where: { id: draftPostId },
        data: { status: PostStatus.DRAFT },
      });
      await e2e.prisma.post.update({
        where: { id: removedPostId },
        data: { deletedAt: new Date() },
      });

      for (const postId of [draftPostId, removedPostId, 'missing-post']) {
        const response = await guest()
          .get(apiPath('/comments'))
          .query({ postId, sort: NEWEST })
          .expect(404);
        expect(response.body).toMatchObject({ message: 'POST_NOT_FOUND' });
      }
      const replies = await guest()
        .get(apiPath(`/comments/${rootId}/replies`))
        .expect(404);
      expect(replies.body).toMatchObject({ message: 'COMMENT_NOT_FOUND' });
    });

    it('відповіді не кореня чи невідомого коментаря → 404', async () => {
      const postId = (await publishPost(admin)).id;
      const [rootId] = await createComments({ postId }, 1);
      const [replyId] = await createComments({ postId, parentId: rootId }, 1);
      for (const id of [replyId, 'missing-comment']) {
        const response = await guest()
          .get(apiPath(`/comments/${id}/replies`))
          .expect(404);
        expect(response.body).toMatchObject({ message: 'COMMENT_NOT_FOUND' });
      }
    });
  });

  describe('межі параметрів → 400', () => {
    let postId: string;
    let otherPostId: string;
    let rootId: string;
    let rootsCursor: string;
    let repliesCursor: string;

    beforeAll(async () => {
      postId = (await publishPost(admin)).id;
      otherPostId = (await publishPost(admin)).id;
      [rootId] = await createComments({ postId }, 2);
      await createComments({ postId: otherPostId }, 2);
      await createComments({ postId, parentId: rootId }, 2);
      rootsCursor = (
        await getRootsPage(guest(), { postId, sort: NEWEST, limit: 1 })
      ).nextCursor as string;
      repliesCursor = (await getRepliesPage(guest(), rootId, { limit: 1 }))
        .nextCursor as string;
    });

    it('курсор зіпсований, з іншої новини, матчу чи гілки → COMMENT_CURSOR_INVALID', async () => {
      const otherCursor = (
        await getRootsPage(guest(), {
          postId: otherPostId,
          sort: NEWEST,
          limit: 1,
        })
      ).nextCursor as string;
      const invalidRequests = [
        {
          path: '/comments',
          query: { postId, sort: NEWEST, cursor: 'garbage!' },
        },
        {
          path: '/comments',
          query: { postId, sort: NEWEST, cursor: otherCursor },
        },
        {
          path: '/comments',
          query: { postId, sort: NEWEST, cursor: repliesCursor },
        },
        {
          path: '/comments',
          query: { matchId: postId, sort: NEWEST, cursor: rootsCursor },
        },
        { path: `/comments/${rootId}/replies`, query: { cursor: rootsCursor } },
      ];
      for (const { path, query } of invalidRequests) {
        const response = await guest()
          .get(apiPath(path))
          .query(query)
          .expect(400);
        expect(response.body).toMatchObject({
          message: 'COMMENT_CURSOR_INVALID',
        });
      }
    });

    it('порядок: без нього чи невідомий → 400 з переліком дозволених', async () => {
      for (const query of [{ postId }, { postId, sort: 'popular' }]) {
        const response = await guest()
          .get(apiPath('/comments'))
          .query(query)
          .expect(400);
        expectMatchesContract(response, 'get', '/comments');
        expect(JSON.stringify(response.body)).toContain(
          'sort must be one of the following values: newest',
        );
      }
    });

    it('ціль — рівно одна, і в читанні, і в записі; ліміт 1…50', async () => {
      for (const query of [
        { sort: NEWEST },
        { postId, matchId: 'some-match', sort: NEWEST },
      ]) {
        const response = await guest()
          .get(apiPath('/comments'))
          .query(query)
          .expect(400);
        expect(response.body).toMatchObject({
          message: 'COMMENT_TARGET_INVALID',
        });
      }
      const twoTargets = await alice
        .post(apiPath('/comments'))
        .send({ content: 'Both targets', postId, matchId: 'some-match' })
        .expect(400);
      expectMatchesContract(twoTargets, 'post', '/comments');
      expect(twoTargets.body).toMatchObject({
        message: 'COMMENT_TARGET_INVALID',
      });
      for (const limit of ['0', '51', 'abc']) {
        await guest()
          .get(apiPath('/comments'))
          .query({ postId, sort: NEWEST, limit })
          .expect(400);
        await guest()
          .get(apiPath(`/comments/${rootId}/replies`))
          .query({ limit })
          .expect(400);
      }
      const widest = await getRootsPage(guest(), {
        postId,
        sort: NEWEST,
        limit: 50,
      });
      expect(widest.items).toHaveLength(2);
    });
  });
});
