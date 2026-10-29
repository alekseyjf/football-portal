import {
  PrismaClient,
  RateLimitAction,
  Role,
  SanctionReason,
  SanctionType,
} from '@prisma/client';
import request from 'supertest';
import { getRateLimitPolicy } from '../../src/security/abuse.constants';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import {
  getRootsPage,
  postComment,
  type CommentItemBody,
} from '../support/e2e-comments';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const MINUTE_MS = 60 * 1000;
const EDIT_PATH = '/comments/{id}';
const COMMENT_BURST_THRESHOLD = getRateLimitPolicy(
  RateLimitAction.COMMENT,
  0,
).burstThreshold;
/** Скільки чекати, доки запит застрягне на блокуванні: 100 × 50 мс = 5 с. */
const LOCK_WAIT_ATTEMPTS = 100;
const LOCK_WAIT_POLL_MS = 50;

/** Чекає, доки зміна тексту стане в чергу на блокування рядка коментаря (його тримає видалення). */
async function waitForBlockedCommentUpdate(prisma: PrismaClient) {
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND query LIKE 'UPDATE%"Comment"%'`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error('UPDATE of Comment never waited for the deletion');
}

/**
 * Зміна тексту свого коментаря (D27, M1.7.4): лише автор і лише 15 хв; межі тексту й бан — як у нового, пауза між
 * коментарями й burst — ні. Пауза тут справжня (60 с, без `COMMENT_COOLDOWN_MS: '0'`): так видно, що зміні вона
 * не заважає; коментарі для інших перевірок засіваємо, скинувши її (`postAfterCooldown`).
 */
describe('Коментарі: зміна тексту автором протягом 15 хв (D27)', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let alice: request.Agent;
  let bob: request.Agent;
  let aliceUser: E2eUser;
  let bobUser: E2eUser;
  let postId: string;

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  function editComment(
    client: request.Agent | ReturnType<typeof guest>,
    commentId: string,
    content: string,
  ) {
    return client.patch(apiPath(`/comments/${commentId}`)).send({ content });
  }

  /** Новий коментар без паузи: події анти-абузу автора прибираємо, як після 60 с. */
  async function postAfterCooldown(
    agent: request.Agent,
    author: E2eUser,
    body: Record<string, string>,
  ): Promise<CommentItemBody> {
    await e2e.prisma.rateLimitEvent.deleteMany({
      where: { userId: author.id },
    });
    return postComment(agent, body);
  }

  /** Коментар опубліковано `minutes` хвилин тому. */
  async function ageComment(commentId: string, minutes: number) {
    await e2e.prisma.comment.update({
      where: { id: commentId },
      data: { createdAt: new Date(Date.now() - minutes * MINUTE_MS) },
    });
  }

  function storedComment(commentId: string) {
    return e2e.prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
      select: { content: true, editedAt: true },
    });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    aliceUser = await createUser(e2e);
    bobUser = await createUser(e2e);
    alice = await loginAs(e2e, aliceUser);
    bob = await loginAs(e2e, bobUser);
    postId = (await publishPost(admin)).id;
  });
  afterAll(() => e2e.close());

  it('14-та хвилина — новий текст і `editedAt`, лайки й мій голос ті самі; читачі бачать зміну', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Arsenal won 2-0',
      postId,
    });
    for (const agent of [alice, bob]) {
      await agent
        .post(apiPath('/likes'))
        .send({ targetType: 'comment', targetId: comment.id, action: 'LIKE' })
        .expect(201);
    }
    await ageComment(comment.id, 14);

    const edited = await editComment(
      alice,
      comment.id,
      '  Arsenal won 2-1  ',
    ).expect(200);
    expectMatchesContract(edited, 'patch', EDIT_PATH);
    const editedBody = edited.body as CommentItemBody;
    expect(editedBody).toMatchObject({
      id: comment.id,
      content: 'Arsenal won 2-1',
      isDeleted: false,
      likeCount: 2,
      myReaction: 'LIKE',
      editedAt: expect.any(String) as string,
    });

    const roots = await getRootsPage(guest(), { postId, sort: 'newest' });
    expect(roots.items.find((item) => item.id === comment.id)).toMatchObject({
      content: 'Arsenal won 2-1',
      editedAt: editedBody.editedAt,
      likeCount: 2,
    });
  });

  it('одразу після публікації — без паузи між коментарями; правки підряд не дають бану; новий коментар паузу чекає', async () => {
    const comment = await postAfterCooldown(bob, bobUser, {
      content: 'Frist take',
      postId,
    });

    for (let edit = 1; edit <= COMMENT_BURST_THRESHOLD + 1; edit++) {
      await editComment(bob, comment.id, `First take, v${edit}`).expect(200);
    }
    expect(
      await e2e.prisma.userSanction.count({ where: { userId: bobUser.id } }),
    ).toBe(0);
    expect((await storedComment(comment.id)).content).toBe(
      `First take, v${COMMENT_BURST_THRESHOLD + 1}`,
    );

    const another = await bob
      .post(apiPath('/comments'))
      .send({ content: 'Second comment', postId })
      .expect(429);
    expect(another.body).toMatchObject({ message: 'COMMENT_COOLDOWN' });
  });

  it('той самий текст (і з пробілами по краях) — 200 без `editedAt`', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Same text',
      postId,
    });

    const unchanged = await editComment(
      alice,
      comment.id,
      '  Same text ',
    ).expect(200);
    expectMatchesContract(unchanged, 'patch', EDIT_PATH);
    expect(unchanged.body).toMatchObject({
      content: 'Same text',
      editedAt: null,
    });
    expect(await storedComment(comment.id)).toEqual({
      content: 'Same text',
      editedAt: null,
    });
  });

  it('16-та хвилина — 403 COMMENT_EDIT_WINDOW_CLOSED, текст той самий', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Too late to fix',
      postId,
    });
    await ageComment(comment.id, 16);

    const late = await editComment(alice, comment.id, 'Fixed').expect(403);
    expectMatchesContract(late, 'patch', EDIT_PATH);
    expect(late.body).toMatchObject({ message: 'COMMENT_EDIT_WINDOW_CLOSED' });
    expect(await storedComment(comment.id)).toEqual({
      content: 'Too late to fix',
      editedAt: null,
    });
  });

  it('чужий коментар — 403 COMMENT_EDIT_FORBIDDEN, і адміну: він лише видаляє', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Mine only',
      postId,
    });

    for (const agent of [bob, admin]) {
      const foreign = await editComment(agent, comment.id, 'Not yours').expect(
        403,
      );
      expectMatchesContract(foreign, 'patch', EDIT_PATH);
      expect(foreign.body).toMatchObject({
        message: 'COMMENT_EDIT_FORBIDDEN',
      });
    }
    expect((await storedComment(comment.id)).content).toBe('Mine only');
  });

  it('видалений, заглушка й невідомий — 404 COMMENT_NOT_FOUND', async () => {
    const root = await postAfterCooldown(alice, aliceUser, {
      content: 'Root with a reply',
      postId,
    });
    const reply = await postAfterCooldown(alice, aliceUser, {
      content: 'Reply to delete',
      postId,
      parentId: root.id,
    });
    await postComment(admin, {
      content: 'Reply keeps the stub',
      postId,
      parentId: root.id,
    });
    await alice.delete(apiPath(`/comments/${reply.id}`)).expect(200);
    // Корінь з живою відповіддю — заглушка «Коментар видалено»
    await alice.delete(apiPath(`/comments/${root.id}`)).expect(200);

    for (const commentId of [reply.id, root.id, 'missing-comment-id']) {
      const gone = await editComment(alice, commentId, 'Back again').expect(
        404,
      );
      expectMatchesContract(gone, 'patch', EDIT_PATH);
      expect(gone.body).toMatchObject({ message: 'COMMENT_NOT_FOUND' });
    }
  });

  it('порожній і задовгий текст — 400, як у нового коментаря; без сесії — 401', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Valid text',
      postId,
    });

    for (const content of ['   ', 'x', 'x'.repeat(2001)]) {
      const invalid = await editComment(alice, comment.id, content).expect(400);
      expectMatchesContract(invalid, 'patch', EDIT_PATH);
    }
    const anonymous = await editComment(guest(), comment.id, 'Guest edit');
    expect(anonymous.status).toBe(401);
    expectMatchesContract(anonymous, 'patch', EDIT_PATH);
    expect((await storedComment(comment.id)).content).toBe('Valid text');
  });

  it('бан на коментарі — 403 COMMENTS_SUSPENDED: змінювати не можна, читати — можна', async () => {
    const comment = await postAfterCooldown(bob, bobUser, {
      content: 'Before the ban',
      postId,
    });
    await e2e.prisma.userSanction.create({
      data: {
        userId: bobUser.id,
        type: SanctionType.COMMENTS_SUSPENDED,
        reason: SanctionReason.COMMENT_BURST,
        endsAt: new Date(Date.now() + 60 * MINUTE_MS),
      },
    });

    const banned = await editComment(bob, comment.id, 'Spam spam').expect(403);
    expectMatchesContract(banned, 'patch', EDIT_PATH);
    expect(banned.body).toMatchObject({ message: 'COMMENTS_SUSPENDED' });
    expect((await storedComment(comment.id)).content).toBe('Before the ban');
    const roots = await getRootsPage(bob, { postId, sort: 'newest' });
    expect(roots.items.map((item) => item.id)).toContain(comment.id);
  });

  it('закритий тред — 403 COMMENT_THREAD_LOCKED; адміну свій — можна', async () => {
    const lockedPostId = (await publishPost(admin)).id;
    const aliceComment = await postAfterCooldown(alice, aliceUser, {
      content: 'Before the lock',
      postId: lockedPostId,
    });
    const adminComment = await postComment(admin, {
      content: 'Moderator note',
      postId: lockedPostId,
    });
    await e2e.prisma.commentThread.update({
      where: { postId: lockedPostId },
      data: { isLocked: true },
    });

    const locked = await editComment(alice, aliceComment.id, 'After').expect(
      403,
    );
    expect(locked.body).toMatchObject({ message: 'COMMENT_THREAD_LOCKED' });
    await editComment(admin, adminComment.id, 'Moderator note, updated').expect(
      200,
    );
  });

  it('зміна, що чекає на видалення, яке вже йде, — перемагає видалення: 404, текст старий', async () => {
    const comment = await postAfterCooldown(alice, aliceUser, {
      content: 'Deleted meanwhile',
      postId,
    });
    let releaseDeletion!: () => void;
    const deletionReleased = new Promise<void>((resolve) => {
      releaseDeletion = resolve;
    });
    let markCommentDeleted!: () => void;
    const commentDeleted = new Promise<void>((resolve) => {
      markCommentDeleted = resolve;
    });
    // Видалення тримає окрема транзакція: рядок заблоковано, а для читань коментар ще живий
    const deletion = e2e.prisma.$transaction(
      async (tx) => {
        await tx.comment.update({
          where: { id: comment.id },
          data: { deletedAt: new Date() },
        });
        markCommentDeleted();
        await deletionReleased;
      },
      { timeout: 15_000 },
    );
    await commentDeleted;

    // Перевірки зміна проходить, а запис чекає, доки видалення завершиться
    const editing = editComment(alice, comment.id, 'Edited meanwhile').then(
      (response) => response,
    );
    try {
      await waitForBlockedCommentUpdate(e2e.prisma);
    } finally {
      releaseDeletion();
      await deletion;
    }

    const response = await editing;
    expect(response.status).toBe(404);
    expectMatchesContract(response, 'patch', EDIT_PATH);
    expect(response.body).toMatchObject({ message: 'COMMENT_NOT_FOUND' });
    expect((await storedComment(comment.id)).content).toBe('Deleted meanwhile');
  });
});
