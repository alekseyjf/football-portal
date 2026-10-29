import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import {
  getRepliesPage,
  getRootsPage,
  postComment,
  type CommentItemBody,
} from '../support/e2e-comments';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

/** Один рівень, як на YouTube (D27): куди пишеться відповідь, що лишає видалення, purge гілки. */
describe('Коментарі: гілка з одного рівня, видалення й purge (D27)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let alice: request.Agent;
  let bob: request.Agent;
  let aliceUser: E2eUser;
  let bobUser: E2eUser;

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  async function newPost(): Promise<string> {
    return (await publishPost(admin)).id;
  }

  async function threadIdOf(postId: string): Promise<string> {
    const thread = await e2e.prisma.commentThread.findUniqueOrThrow({
      where: { postId },
      select: { id: true },
    });
    return thread.id;
  }

  async function counters(rootId: string) {
    const root = await e2e.prisma.comment.findUniqueOrThrow({
      where: { id: rootId },
      select: { replyCount: true, thread: { select: { commentCount: true } } },
    });
    return {
      replyCount: root.replyCount,
      commentCount: root.thread.commentCount,
    };
  }

  beforeAll(async () => {
    // Без паузи між коментарями: тест пише кілька підряд від одного автора
    e2e = await createE2eApp({ envOverrides: { COMMENT_COOLDOWN_MS: '0' } });
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    aliceUser = await createUser(e2e);
    bobUser = await createUser(e2e);
    alice = await loginAs(e2e, aliceUser);
    bob = await loginAs(e2e, bobUser);
  });
  afterAll(() => e2e.close());

  describe('куди пишеться відповідь', () => {
    let postId: string;
    let root: CommentItemBody;
    let replyToRoot: CommentItemBody;

    beforeAll(async () => {
      postId = await newPost();
      root = await postComment(admin, { content: 'Great derby', postId });
      replyToRoot = await postComment(alice, {
        content: 'Agreed',
        postId,
        parentId: root.id,
      });
    });

    it('відповідь на корінь — під ним, без адресата', () => {
      expect(replyToRoot).toMatchObject({
        parentId: root.id,
        replyTo: null,
        replyCount: 0,
        likeCount: 0,
        myReaction: null,
        isDeleted: false,
      });
    });

    it('старий клієнт відповідає на відповідь — запис у корені гілки, адресат — автор відповіді', async () => {
      const replyToReply = await postComment(bob, {
        content: 'Not sure about that',
        postId,
        parentId: replyToRoot.id,
      });
      expect(replyToReply).toMatchObject({
        parentId: root.id,
        replyTo: {
          commentId: replyToRoot.id,
          author: { id: aliceUser.id },
        },
      });

      const stored = await e2e.prisma.comment.findUniqueOrThrow({
        where: { id: replyToReply.id },
        select: {
          parentId: true,
          rootId: true,
          depth: true,
          replyToCommentId: true,
          replyToUserId: true,
        },
      });
      expect(stored).toEqual({
        parentId: root.id,
        rootId: root.id,
        depth: 1,
        replyToCommentId: replyToRoot.id,
        replyToUserId: aliceUser.id,
      });

      const replies = await getRepliesPage(guest(), root.id);
      expect(replies.items.map((item) => item.id)).toEqual([
        replyToRoot.id,
        replyToReply.id,
      ]);
      expect(await counters(root.id)).toEqual({
        replyCount: 2,
        commentCount: 3,
      });
    });

    it('глибшу відповідь, корінь з адресатом чи відповідь не під коренем записом в обхід API відхиляє БД (CHECK)', async () => {
      const threadId = await threadIdOf(postId);
      const base = { threadId, authorId: bobUser.id, content: 'bypass' };
      const invalidRows = [
        { parentId: replyToRoot.id, rootId: root.id, depth: 2 },
        { parentId: root.id, rootId: null, depth: 1 },
        { parentId: root.id, rootId: root.id, depth: 0 },
        { parentId: null, rootId: null, depth: 0, replyToUserId: aliceUser.id },
        {
          parentId: null,
          rootId: null,
          depth: 0,
          replyToCommentId: replyToRoot.id,
        },
      ];
      for (const invalidRow of invalidRows) {
        await expect(
          e2e.prisma.comment.create({ data: { ...base, ...invalidRow } }),
        ).rejects.toThrow(/Comment_single_level_check/);
      }
    });
  });

  describe('видалення', () => {
    it('видалили відповідь — інші відповіді лишились, навіть та, що відповідала їй', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Root', postId });
      const first = await postComment(alice, {
        content: 'First reply',
        postId,
        parentId: root.id,
      });
      const answer = await postComment(admin, {
        content: 'Answer to first',
        postId,
        parentId: first.id,
      });

      const deleted = await alice
        .delete(apiPath(`/comments/${first.id}`))
        .expect(200);
      expectMatchesContract(deleted, 'delete', '/comments/{id}');
      expect(deleted.body).toEqual({ id: first.id });

      const replies = await getRepliesPage(guest(), root.id);
      expect(replies.items.map((item) => item.id)).toEqual([answer.id]);
      expect(replies.items[0].replyTo).toMatchObject({
        commentId: first.id,
        author: { id: aliceUser.id },
      });
      expect(await counters(root.id)).toEqual({
        replyCount: 1,
        commentCount: 2,
      });
    });

    it('видалили корінь з відповідями — заглушка без тексту й автора, відповіді на місці', async () => {
      const postId = await newPost();
      const root = await postComment(bob, {
        content: 'Root to delete',
        postId,
      });
      const reply = await postComment(admin, {
        content: 'Reply stays',
        postId,
        parentId: root.id,
      });

      await bob.delete(apiPath(`/comments/${root.id}`)).expect(200);

      const roots = await getRootsPage(guest(), { postId, sort: 'newest' });
      expect(roots.items).toEqual([
        expect.objectContaining({
          id: root.id,
          isDeleted: true,
          content: null,
          author: null,
          replyCount: 1,
        }),
      ]);
      const replies = await getRepliesPage(guest(), root.id);
      expect(replies.items.map((item) => item.id)).toEqual([reply.id]);
      // Заглушка не рахується серед живих
      expect(await counters(root.id)).toEqual({
        replyCount: 1,
        commentCount: 1,
      });

      // Розмова під заглушкою триває: відповідь на живу відповідь — так, на саму заглушку — ні
      const answer = await postComment(admin, {
        content: 'Still talking',
        postId,
        parentId: reply.id,
      });
      expect(answer.parentId).toBe(root.id);
      const toStub = await admin
        .post(apiPath('/comments'))
        .send({ content: 'To the stub', postId, parentId: root.id })
        .expect(404);
      expectMatchesContract(toStub, 'post', '/comments');
      expect(toStub.body).toMatchObject({
        message: 'PARENT_COMMENT_NOT_FOUND',
      });
    });

    it('видалили останню відповідь під заглушкою — зникла й заглушка', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Root', postId });
      const reply = await postComment(admin, {
        content: 'Only reply',
        postId,
        parentId: root.id,
      });
      await admin.delete(apiPath(`/comments/${root.id}`)).expect(200);
      expect(
        (await getRootsPage(guest(), { postId, sort: 'newest' })).items,
      ).toHaveLength(1);

      await admin.delete(apiPath(`/comments/${reply.id}`)).expect(200);

      const roots = await getRootsPage(guest(), { postId, sort: 'newest' });
      expect(roots).toEqual({ items: [], nextCursor: null });
      const gone = await guest()
        .get(apiPath(`/comments/${root.id}/replies`))
        .expect(404);
      expectMatchesContract(gone, 'get', '/comments/{id}/replies');
      expect(gone.body).toMatchObject({ message: 'COMMENT_NOT_FOUND' });
      expect(await counters(root.id)).toEqual({
        replyCount: 0,
        commentCount: 0,
      });
    });

    it('корінь без відповідей — зник; рядок лишився з deletedAt (soft delete)', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Lonely root', postId });

      await admin.delete(apiPath(`/comments/${root.id}`)).expect(200);

      const roots = await getRootsPage(guest(), { postId, sort: 'newest' });
      expect(roots.items).toEqual([]);
      const stored = await e2e.prisma.comment.findUnique({
        where: { id: root.id },
        select: { deletedAt: true },
      });
      expect(stored?.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('purge (ADMIN)', () => {
    it('purge відповіді — «листок»; адресат тих, хто їй відповідав, лишається без коментаря', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Root', postId });
      const target = await postComment(alice, {
        content: 'To purge',
        postId,
        parentId: root.id,
      });
      const answer = await postComment(admin, {
        content: 'Answer',
        postId,
        parentId: target.id,
      });

      const purged = await admin
        .delete(apiPath(`/comments/${target.id}/purge`))
        .expect(200);
      expectMatchesContract(purged, 'delete', '/comments/{id}/purge');
      expect(purged.body).toEqual({ id: target.id, purgedCount: 1 });

      const replies = await getRepliesPage(guest(), root.id);
      expect(replies.items.map((item) => item.id)).toEqual([answer.id]);
      expect(replies.items[0].replyTo).toMatchObject({
        commentId: null,
        author: { id: aliceUser.id },
      });
      expect(await counters(root.id)).toEqual({
        replyCount: 1,
        commentCount: 2,
      });
    });

    it('purge-thread кореня — разом з усіма відповідями гілки, і soft-видаленими', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Root', postId });
      const keptRoot = await postComment(admin, {
        content: 'Other root',
        postId,
      });
      const live = await postComment(admin, {
        content: 'Live reply',
        postId,
        parentId: root.id,
      });
      const deleted = await postComment(admin, {
        content: 'Deleted reply',
        postId,
        parentId: live.id,
      });
      await admin.delete(apiPath(`/comments/${deleted.id}`)).expect(200);

      const purged = await admin
        .delete(apiPath(`/comments/${root.id}/purge-thread`))
        .expect(200);
      expectMatchesContract(purged, 'delete', '/comments/{id}/purge-thread');
      expect(purged.body).toEqual({ id: root.id, purgedCount: 3 });

      const remaining = await e2e.prisma.comment.findMany({
        where: { id: { in: [root.id, live.id, deleted.id, keptRoot.id] } },
        select: { id: true },
      });
      expect(remaining).toEqual([{ id: keptRoot.id }]);
      expect(await counters(keptRoot.id)).toEqual({
        replyCount: 0,
        commentCount: 1,
      });
    });

    it('purge-thread відповіді — лише вона; корінь з відповідями purge не видаляє', async () => {
      const postId = await newPost();
      const root = await postComment(admin, { content: 'Root', postId });
      const first = await postComment(admin, {
        content: 'First',
        postId,
        parentId: root.id,
      });
      const second = await postComment(admin, {
        content: 'Second',
        postId,
        parentId: root.id,
      });

      const purged = await admin
        .delete(apiPath(`/comments/${first.id}/purge-thread`))
        .expect(200);
      expect(purged.body).toEqual({ id: first.id, purgedCount: 1 });
      const replies = await getRepliesPage(guest(), root.id);
      expect(replies.items.map((item) => item.id)).toEqual([second.id]);

      const blocked = await admin
        .delete(apiPath(`/comments/${root.id}/purge`))
        .expect(409);
      expectMatchesContract(blocked, 'delete', '/comments/{id}/purge');
      expect(blocked.body).toMatchObject({ message: 'COMMENT_HAS_REPLIES' });
    });
  });
});
