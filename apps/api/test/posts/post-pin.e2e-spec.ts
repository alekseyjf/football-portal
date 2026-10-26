import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

interface CreatedPost {
  id: string;
  number: number;
}

interface PostCard {
  id: string;
}

interface HomeBody {
  lead: PostCard | null;
  latest: PostCard[];
}

interface AdminPostBody {
  id: string;
  updatedAt: string;
  pinnedAt: string | null;
  pinnedBy: { id: string; name: string; isDeleted: boolean } | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Скільки чекати, доки запит застрягне на блокуванні: 100 × 50 мс = 5 с. */
const LOCK_WAIT_ATTEMPTS = 100;
const LOCK_WAIT_POLL_MS = 50;
/** Живих новин у стрічці: на одну більше, ніж головна + шість, — найстаріша не потрапляє на головну сама. */
const FEED_POST_COUNT = 8;
/** Поля закріплення, яких публічні відповіді не віддають (D56). */
const ADMIN_ONLY_PIN_FIELDS = ['pinnedAt', 'pinnedById', 'pinnedBy'];

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

function englishTranslation(title: string) {
  return {
    languageCode: 'en',
    title,
    excerpt: 'A short summary of the news.',
    content: 'The full text of the news for the home lead test.',
  };
}

function ids(posts: PostCard[]): string[] {
  return posts.map((post) => post.id);
}

function expectNoPinFields(post: object) {
  for (const field of ADMIN_ONLY_PIN_FIELDS) {
    expect(post).not.toHaveProperty(field);
  }
}

/** Чекає, доки запит закріплення стане в чергу на блокування, яке тримає окрема транзакція. */
async function waitForBlockedQuery(prisma: PrismaClient, queryPart: string) {
  for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND query LIKE ${`%${queryPart}%`}`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error(`No query waited for a lock: ${queryPart}`);
}

/**
 * Головна новина (M1.6.4, D56): редактор закріплює живу новину, заміна — лише підтверджена, зміни публікації
 * знімають закріплення; сайт бере головну й шість найсвіжіших з `GET /posts/home`, хто закріпив — лише в адмінці.
 */
describe('Головна новина: закріплення редактором', () => {
  let e2e: E2eApp;
  let admin: request.Agent;
  let editorUser: E2eUser;
  let editor: request.Agent;
  /** Найсвіжіші першими: `feedPosts[0]` — найсвіжіша */
  let feedPosts: CreatedPost[];

  function guest() {
    return request(e2e.app.getHttpServer());
  }

  async function createPost(fields: object): Promise<CreatedPost> {
    const response = await admin
      .post(apiPath('/posts'))
      .send(fields)
      .expect(201);
    return response.body as CreatedPost;
  }

  /** Жива новина, старша за всі новини стрічки, — сама на головну не потрапляє. */
  function createOldPost(title: string): Promise<CreatedPost> {
    return createPost({
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
      translations: [englishTranslation(title)],
    });
  }

  function pin(
    postId: string,
    replacesPostId: string | null,
    agent: request.Agent = admin,
  ) {
    return agent.post(apiPath(`/posts/${postId}/pin`)).send({ replacesPostId });
  }

  async function pinOk(
    postId: string,
    replacesPostId: string | null,
    agent: request.Agent = admin,
  ): Promise<AdminPostBody> {
    const response = await pin(postId, replacesPostId, agent).expect(200);
    expectMatchesContract(response, 'post', '/posts/{id}/pin');
    return response.body as AdminPostBody;
  }

  function updatePost(postId: string, fields: object) {
    return admin
      .put(apiPath(`/posts/${postId}`))
      .send(fields)
      .expect(200);
  }

  async function homePosts(): Promise<HomeBody> {
    const response = await guest()
      .get(apiPath('/posts/home'))
      .query({ lang: 'uk' })
      .expect(200);
    expectMatchesContract(response, 'get', '/posts/home');
    return response.body as HomeBody;
  }

  async function adminPost(postId: string): Promise<AdminPostBody> {
    const response = await admin
      .get(apiPath(`/posts/admin/${postId}`))
      .expect(200);
    return response.body as AdminPostBody;
  }

  async function pinnedPostId(): Promise<string | null> {
    const response = await admin
      .get(apiPath('/posts/admin/pinned'))
      .expect(200);
    expectMatchesContract(response, 'get', '/posts/admin/pinned');
    return (response.body as { post: { id: string } | null }).post?.id ?? null;
  }

  async function pinnedRowCount(): Promise<number> {
    return e2e.prisma.post.count({ where: { pinnedAt: { not: null } } });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    editorUser = await createUser(e2e, Role.ADMIN);
    editor = await loginAs(e2e, editorUser);

    feedPosts = [];
    for (let index = 0; index < FEED_POST_COUNT; index++) {
      feedPosts.push(
        await createPost({
          status: 'PUBLISHED',
          publishedAt: hoursAgoIso(index + 1),
          translations: [englishTranslation(`Feed news ${index + 1}`)],
        }),
      );
    }
  });

  beforeEach(async () => {
    await e2e.prisma.post.updateMany({
      data: { pinnedAt: null, pinnedById: null },
    });
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('без закріпленої головна — найсвіжіша, під нею шість наступних', async () => {
    const home = await homePosts();
    expect(home.lead?.id).toBe(feedPosts[0].id);
    expect(ids(home.latest)).toEqual(ids(feedPosts.slice(1, 7)));
    expect(await pinnedPostId()).toBeNull();
  });

  it('закріпити старішу за сім найсвіжіших: хто й коли — у відповіді, головна — вона, під нею шість найсвіжіших', async () => {
    const oldestFeedPost = feedPosts[FEED_POST_COUNT - 1];
    const before = await adminPost(oldestFeedPost.id);

    const pinned = await pinOk(oldestFeedPost.id, null, editor);
    expect(pinned.pinnedBy).toEqual(
      expect.objectContaining({ id: editorUser.id, isDeleted: false }),
    );
    expect(Date.now() - Date.parse(pinned.pinnedAt!)).toBeLessThan(60_000);
    // Закріплення — не збереження тексту: «Saved …» у формі адмінки не зсувається
    expect(pinned.updatedAt).toBe(before.updatedAt);

    const home = await homePosts();
    expect(home.lead?.id).toBe(oldestFeedPost.id);
    expect(ids(home.latest)).toEqual(ids(feedPosts.slice(0, 6)));
    expect(await pinnedPostId()).toBe(oldestFeedPost.id);
    expect(await adminPost(oldestFeedPost.id)).toMatchObject({
      pinnedAt: pinned.pinnedAt,
      pinnedBy: { id: editorUser.id },
    });
  });

  it('закріплена серед найсвіжіших — під головною шість інших, без дубля', async () => {
    await pinOk(feedPosts[2].id, null);
    const home = await homePosts();
    expect(home.lead?.id).toBe(feedPosts[2].id);
    expect(ids(home.latest)).toEqual(
      ids([...feedPosts.slice(0, 2), ...feedPosts.slice(3, 7)]),
    );
  });

  it('публічні відповіді не віддають, хто й коли закріпив', async () => {
    await pinOk(feedPosts[0].id, null);

    const home = await homePosts();
    for (const post of [home.lead!, ...home.latest]) expectNoPinFields(post);

    const feed = await guest().get(apiPath('/posts')).expect(200);
    expectMatchesContract(feed, 'get', '/posts');
    for (const post of (feed.body as { data: object[] }).data) {
      expectNoPinFields(post);
    }

    const detail = await guest()
      .get(apiPath(`/posts/${feedPosts[0].number}`))
      .expect(200);
    expectMatchesContract(detail, 'get', '/posts/{number}');
    expectNoPinFields(detail.body as object);
  });

  it('замінити підтверджену: попередня відкріплена, закріплена — нова', async () => {
    await pinOk(feedPosts[3].id, null);
    await pinOk(feedPosts[4].id, feedPosts[3].id);

    expect(await pinnedPostId()).toBe(feedPosts[4].id);
    expect(await adminPost(feedPosts[3].id)).toMatchObject({
      pinnedAt: null,
      pinnedBy: null,
    });
    expect(await pinnedRowCount()).toBe(1);
  });

  it('застаріле підтвердження → 409 PINNED_POST_CHANGED, закріплена не змінюється', async () => {
    await pinOk(feedPosts[3].id, null);

    for (const replacesPostId of [null, feedPosts[5].id]) {
      const response = await pin(feedPosts[4].id, replacesPostId).expect(409);
      expectMatchesContract(response, 'post', '/posts/{id}/pin');
      expect(response.body).toMatchObject({ message: 'PINNED_POST_CHANGED' });
    }
    expect(await pinnedPostId()).toBe(feedPosts[3].id);
  });

  it('уже закріплена — без змін: хто й коли закріпив лишаються', async () => {
    const first = await pinOk(feedPosts[1].id, null, editor);
    const repeated = await pinOk(feedPosts[1].id, null);
    expect(repeated).toMatchObject({
      pinnedAt: first.pinnedAt,
      pinnedBy: { id: editorUser.id },
    });
  });

  it('відкріпити: головна — найсвіжіша; повтор — без змін', async () => {
    await pinOk(feedPosts[5].id, null);
    const before = await adminPost(feedPosts[5].id);

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await admin
        .delete(apiPath(`/posts/${feedPosts[5].id}/pin`))
        .expect(200);
      expectMatchesContract(response, 'delete', '/posts/{id}/pin');
      expect(response.body).toMatchObject({
        pinnedAt: null,
        pinnedBy: null,
        updatedAt: before.updatedAt,
      });
    }
    expect((await homePosts()).lead?.id).toBe(feedPosts[0].id);
  });

  it.each<[string, () => Promise<CreatedPost>]>([
    [
      'чернетка',
      () => createPost({ translations: [englishTranslation('Draft news')] }),
    ],
    [
      'ще не випущена запланована',
      () =>
        createPost({
          status: 'SCHEDULED',
          publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
          translations: [englishTranslation('Scheduled news')],
        }),
    ],
    [
      'архівна',
      async () => {
        const post = await createOldPost('Archived news');
        await admin
          .put(apiPath(`/posts/${post.id}`))
          .send({ status: 'ARCHIVED' })
          .expect(200);
        return post;
      },
    ],
  ])('%s → 409 POST_NOT_LIVE', async (_case, createNotLivePost) => {
    const post = await createNotLivePost();
    const response = await pin(post.id, null).expect(409);
    expectMatchesContract(response, 'post', '/posts/{id}/pin');
    expect(response.body).toMatchObject({ message: 'POST_NOT_LIVE' });
    expect(await pinnedRowCount()).toBe(0);
  });

  it.each<[string, (postId: string) => Promise<unknown>]>([
    ['зняли з публікації', (postId) => updatePost(postId, { status: 'DRAFT' })],
    ['в архів', (postId) => updatePost(postId, { status: 'ARCHIVED' })],
    [
      'перенесли в майбутнє',
      (postId) =>
        updatePost(postId, {
          status: 'SCHEDULED',
          publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
        }),
    ],
    [
      'видалили',
      (postId) => admin.delete(apiPath(`/posts/${postId}`)).expect(200),
    ],
  ])(
    '%s → закріплення знято, головна — найсвіжіша',
    async (_case, takeOffSite) => {
      const post = await createOldPost('Pinned and taken off the site');
      await pinOk(post.id, null, editor);

      await takeOffSite(post.id);

      expect(await pinnedRowCount()).toBe(0);
      expect((await homePosts()).lead?.id).toBe(feedPosts[0].id);
      const row = await e2e.prisma.post.findUniqueOrThrow({
        where: { id: post.id },
        select: { pinnedAt: true, pinnedById: true },
      });
      expect(row).toEqual({ pinnedAt: null, pinnedById: null });
    },
  );

  it('правка тексту закріпленої — закріплення лишається', async () => {
    const post = await createOldPost('Pinned and edited');
    const pinned = await pinOk(post.id, null);

    await updatePost(post.id, {
      translations: [englishTranslation('Pinned and edited again')],
    });

    expect(await adminPost(post.id)).toMatchObject({
      pinnedAt: pinned.pinnedAt,
    });
    expect((await homePosts()).lead?.id).toBe(post.id);
  });

  it('хто закріпив: анонімізований — «Deleted user», рядок видалено фізично — закріплення лишається без імені', async () => {
    const pinner = await createUser(e2e, Role.ADMIN);
    const pinned = await pinOk(
      feedPosts[6].id,
      null,
      await loginAs(e2e, pinner),
    );

    // Адміна не анонімізують (ADMIN_ACCOUNT_NOT_DELETABLE) — спершу роль, як після зняття прав
    await e2e.prisma.user.update({
      where: { id: pinner.id },
      data: { role: Role.USER },
    });
    await admin.delete(apiPath(`/users/${pinner.id}`)).expect(200);
    expect(await adminPost(feedPosts[6].id)).toMatchObject({
      pinnedAt: pinned.pinnedAt,
      pinnedBy: { id: pinner.id, name: 'Deleted user', isDeleted: true },
    });

    await e2e.prisma.user.delete({ where: { id: pinner.id } });
    expect(await adminPost(feedPosts[6].id)).toMatchObject({
      pinnedAt: pinned.pinnedAt,
      pinnedBy: null,
    });
    expect((await homePosts()).lead?.id).toBe(feedPosts[6].id);
  });

  // 401 / 403 — на кожному захищеному роуті, і на цих теж: auth/access-control.e2e-spec.ts
  it('немає чи видалена → 404, без `replacesPostId` чи не рядок → 400', async () => {
    const postId = feedPosts[0].id;

    const deletedPost = await createOldPost('Deleted news');
    await admin.delete(apiPath(`/posts/${deletedPost.id}`)).expect(200);
    for (const missingId of ['missing-post-id', deletedPost.id]) {
      const pinResponse = await pin(missingId, null).expect(404);
      expectMatchesContract(pinResponse, 'post', '/posts/{id}/pin');
      expect(pinResponse.body).toMatchObject({ message: 'POST_NOT_FOUND' });
      const unpinResponse = await admin
        .delete(apiPath(`/posts/${missingId}/pin`))
        .expect(404);
      expectMatchesContract(unpinResponse, 'delete', '/posts/{id}/pin');
    }

    for (const body of [{}, { replacesPostId: 42 }, { replacesPostId: '' }]) {
      const response = await admin
        .post(apiPath(`/posts/${postId}/pin`))
        .send(body)
        .expect(400);
      expectMatchesContract(response, 'post', '/posts/{id}/pin');
    }
    expect(await pinnedRowCount()).toBe(0);
  });

  it('паралельно закріпили іншу, поки ця чекала на індексі → 409 PINNED_POST_CHANGED, закріплена рівно одна', async () => {
    const [rival, mine] = [feedPosts[3], feedPosts[4]];
    let releaseRival!: () => void;
    const rivalReleased = new Promise<void>((resolve) => {
      releaseRival = resolve;
    });
    let markRivalPinned!: () => void;
    const rivalPinned = new Promise<void>((resolve) => {
      markRivalPinned = resolve;
    });
    // Інший редактор закріпив `rival`, але ще не закомітив: для інших запитів закріпленої немає
    const rivalPin = e2e.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          UPDATE "Post" SET "pinnedAt" = now(), "pinnedById" = ${editorUser.id}
          WHERE "id" = ${rival.id}`;
        markRivalPinned();
        await rivalReleased;
      },
      { timeout: 15_000 },
    );
    await rivalPinned;

    const saving = pin(mine.id, null).then((response) => response);
    try {
      await waitForBlockedQuery(e2e.prisma, 'UPDATE "Post" SET "pinnedAt" =');
    } finally {
      releaseRival();
      await rivalPin;
    }

    const response = await saving;
    expect(response.status).toBe(409);
    expectMatchesContract(response, 'post', '/posts/{id}/pin');
    expect(response.body).toMatchObject({ message: 'PINNED_POST_CHANGED' });
    expect(await pinnedRowCount()).toBe(1);
    expect(await pinnedPostId()).toBe(rival.id);
  });

  it('закріплену замінили, поки заміна чекала на її блокуванні → 409 PINNED_POST_CHANGED, закріплена рівно одна', async () => {
    const [current, rival, mine] = [feedPosts[1], feedPosts[2], feedPosts[3]];
    await pinOk(current.id, null);
    let releaseRival!: () => void;
    const rivalReleased = new Promise<void>((resolve) => {
      releaseRival = resolve;
    });
    let markRivalLocked!: () => void;
    const rivalLocked = new Promise<void>((resolve) => {
      markRivalLocked = resolve;
    });
    // Інший редактор замінює `current` на `rival` — рядок `current` заблоковано до коміту
    const rivalSwap = e2e.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT 1 FROM "Post" WHERE "id" = ${current.id} FOR NO KEY UPDATE`;
        await tx.$executeRaw`
          UPDATE "Post" SET "pinnedAt" = NULL, "pinnedById" = NULL
          WHERE "id" = ${current.id}`;
        await tx.$executeRaw`
          UPDATE "Post" SET "pinnedAt" = now(), "pinnedById" = ${editorUser.id}
          WHERE "id" = ${rival.id}`;
        markRivalLocked();
        await rivalReleased;
      },
      { timeout: 15_000 },
    );
    await rivalLocked;

    const saving = pin(mine.id, current.id).then((response) => response);
    try {
      await waitForBlockedQuery(e2e.prisma, '"pinnedAt" IS NOT NULL');
    } finally {
      releaseRival();
      await rivalSwap;
    }

    const response = await saving;
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ message: 'PINNED_POST_CHANGED' });
    expect(await pinnedRowCount()).toBe(1);
    expect(await pinnedPostId()).toBe(rival.id);
  });
});
