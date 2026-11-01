import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostStatus, Prisma, Role } from '@prisma/client';
import type request from 'supertest';
import {
  POST_PUBLISHED_EVENT,
  POST_UNPUBLISHED_EVENT,
  POST_UPDATED_EVENT,
  type PostEventName,
  type PostRef,
} from '../../src/posts/post-events';
import {
  SCHEDULED_POST_BATCH_SIZE,
  ScheduledPostPublisher,
} from '../../src/posts/scheduled-post-publisher.service';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOCK_WAIT_ATTEMPTS = 100;
const LOCK_WAIT_POLL_MS = 50;

const POST_EN = {
  languageCode: 'en',
  title: 'Arsenal win the derby',
  excerpt: 'A late winner settled a tense London derby.',
  content: 'The hosts scored in stoppage time to take all three points.',
};
const POST_UK = {
  languageCode: 'uk',
  title: 'Арсенал виграв дербі',
  excerpt: 'Пізній гол вирішив напружене лондонське дербі.',
  content: 'Господарі забили в компенсований час і взяли три очки.',
};

interface CreatedPost {
  id: string;
  number: number;
  slug: string;
  status: string;
  publishedAt: string | null;
}

/** Подія, як її отримав підписник, і статус новини в БД, який він у ту мить бачить. */
interface ReceivedEvent {
  name: PostEventName;
  post: PostRef;
  statusSeen: Promise<PostStatus | undefined>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Публікація за розкладом і події адреси новини (D57): воркер переводить заплановані, чия дата настала, у PUBLISHED
 * рівно раз; подію шле лише той, хто справді змінив статус, і лише після коміту. Гонки — детерміновано: блокування
 * тримає окрема транзакція (backend Rule 10).
 */
describe('Публікація за розкладом і події новини (D57)', () => {
  let e2e: E2eApp;
  let adminUser: E2eUser;
  let admin: request.Agent;
  let publisher: ScheduledPostPublisher;
  let receivedEvents: ReceivedEvent[];

  function receiveEvent(name: PostEventName) {
    return (post: PostRef) => {
      receivedEvents.push({
        name,
        post,
        // Читання — окремим з'єднанням: незакомічений запис воно б не побачило
        statusSeen: e2e.prisma.post
          .findUnique({ where: { id: post.id }, select: { status: true } })
          .then((row) => row?.status),
      });
    };
  }

  function eventsOf(postId: string) {
    return receivedEvents
      .filter((event) => event.post.id === postId)
      .map(({ name, post }) => ({ name, slug: post.slug }));
  }

  async function createPost(fields: object): Promise<CreatedPost> {
    const response = await admin
      .post(apiPath('/posts'))
      .send({ translations: [POST_EN], ...fields })
      .expect(201);
    return response.body as CreatedPost;
  }

  function updatePost(postId: string, fields: object) {
    return admin.put(apiPath(`/posts/${postId}`)).send(fields);
  }

  /** Заплановані в обхід API: дата, що вже настала, — як після простою воркера. */
  async function insertScheduledPosts(
    count: number,
    publishedAt: Date,
    fields: Partial<Prisma.PostCreateManyInput> = {},
  ): Promise<string[]> {
    const ids = Array.from({ length: count }, () => randomUUID());
    await e2e.prisma.post.createMany({
      data: ids.map((id) => ({
        id,
        slug: 'scheduled-news',
        status: PostStatus.SCHEDULED,
        publishedAt,
        authorId: adminUser.id,
        ...fields,
      })),
    });
    await e2e.prisma.postTranslation.createMany({
      data: ids.map((postId) => ({ postId, ...POST_EN })),
    });
    return ids;
  }

  async function statusOf(postId: string): Promise<PostStatus | undefined> {
    const row = await e2e.prisma.post.findUnique({
      where: { id: postId },
      select: { status: true },
    });
    return row?.status;
  }

  async function isWaitingForPostLock(): Promise<boolean> {
    const [{ waiting }] = await e2e.prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND query LIKE '%"Post"%'`;
    return waiting > 0;
  }

  /**
   * `work` під блокуванням, яке тримає окрема транзакція (`lock`): чекає, доки `work` завершиться або застрягне на
   * блокуванні, і лише тоді відпускає. `wasBlocked` — чи чекав `work` на рядок.
   */
  async function whileLocked<Result>(
    lock: (tx: Prisma.TransactionClient) => Promise<unknown>,
    work: () => Promise<Result>,
  ): Promise<{ result: Result; wasBlocked: boolean }> {
    let releaseLock!: () => void;
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let markLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      markLocked = resolve;
    });
    const lockHolder = e2e.prisma.$transaction(
      async (tx) => {
        await lock(tx);
        markLocked();
        await lockReleased;
      },
      { timeout: 15_000 },
    );
    await Promise.race([locked, lockHolder]);

    const pendingWork = work();
    let isSettled = false;
    const markSettled = () => {
      isSettled = true;
    };
    void pendingWork.then(markSettled, markSettled);
    let wasBlocked = false;
    try {
      for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
        if (isSettled) break;
        if (await isWaitingForPostLock()) {
          wasBlocked = true;
          break;
        }
        await sleep(LOCK_WAIT_POLL_MS);
      }
    } finally {
      releaseLock();
      await lockHolder;
    }
    return { result: await pendingWork, wasBlocked };
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    adminUser = await createUser(e2e, Role.ADMIN);
    admin = await loginAs(e2e, adminUser);
    publisher = e2e.app.get(ScheduledPostPublisher);
    const eventEmitter = e2e.app.get(EventEmitter2);
    eventEmitter.on(POST_PUBLISHED_EVENT, receiveEvent(POST_PUBLISHED_EVENT));
    eventEmitter.on(POST_UPDATED_EVENT, receiveEvent(POST_UPDATED_EVENT));
    eventEmitter.on(
      POST_UNPUBLISHED_EVENT,
      receiveEvent(POST_UNPUBLISHED_EVENT),
    );
  });
  afterAll(() => e2e.close());

  beforeEach(async () => {
    // Кожен тест — зі своїми запланованими: чужі прострочені не потрапляють у його прохід воркера
    await e2e.prisma.post.updateMany({
      where: { status: PostStatus.SCHEDULED },
      data: { deletedAt: new Date() },
    });
    receivedEvents = [];
  });

  it('прострочені → PUBLISHED рівно раз, порцією 100 і хвостом; майбутні й видалені — ні; дата й updatedAt — ті самі', async () => {
    const now = new Date();
    const dueAt = new Date(now.getTime() - HOUR_MS);
    const dueIds = await insertScheduledPosts(
      SCHEDULED_POST_BATCH_SIZE + 1,
      dueAt,
    );
    const [futureId] = await insertScheduledPosts(
      1,
      new Date(now.getTime() + HOUR_MS),
    );
    const [deletedId] = await insertScheduledPosts(1, dueAt, {
      deletedAt: now,
    });
    const before = await e2e.prisma.post.findUniqueOrThrow({
      where: { id: dueIds[0] },
      select: { updatedAt: true },
    });

    expect(await publisher.publishDue(now)).toBe(dueIds.length);
    expect(await publisher.publishDue(now)).toBe(0);

    const published = await e2e.prisma.post.findMany({
      where: { id: { in: dueIds }, status: PostStatus.PUBLISHED },
      select: { publishedAt: true },
    });
    expect(published).toHaveLength(dueIds.length);
    expect(
      published.every(
        (post) => post.publishedAt?.getTime() === dueAt.getTime(),
      ),
    ).toBe(true);
    expect(await statusOf(futureId)).toBe(PostStatus.SCHEDULED);
    expect(await statusOf(deletedId)).toBe(PostStatus.SCHEDULED);
    // `updatedAt` — дата збереження тексту (D56): воркер її не зсуває
    expect(
      await e2e.prisma.post.findUniqueOrThrow({
        where: { id: dueIds[0] },
        select: { updatedAt: true },
      }),
    ).toEqual(before);

    // Одна подія на новину — і лише після коміту: підписник бачить її опублікованою
    expect(receivedEvents.map((event) => event.post.id).sort()).toEqual(
      [...dueIds].sort(),
    );
    expect(
      receivedEvents.every((event) => event.name === POST_PUBLISHED_EVENT),
    ).toBe(true);
    const statusesSeen = await Promise.all(
      receivedEvents.map((event) => event.statusSeen),
    );
    expect(new Set(statusesSeen)).toEqual(new Set([PostStatus.PUBLISHED]));
  });

  it('до проходу воркера запланована, чия дата настала, — не на сайті (стрічка, новина, лайк); після — на сайті', async () => {
    const [dueId] = await insertScheduledPosts(
      1,
      new Date(Date.now() - HOUR_MS),
    );
    const { number } = await e2e.prisma.post.findUniqueOrThrow({
      where: { id: dueId },
      select: { number: true },
    });
    const feedNumbers = async () => {
      const response = await admin
        .get(apiPath('/posts'))
        .query({ limit: 50 })
        .expect(200);
      return (response.body as { data: { number: number }[] }).data.map(
        (post) => post.number,
      );
    };

    await admin.get(apiPath(`/posts/${number}`)).expect(404);
    expect(await feedNumbers()).not.toContain(number);
    await admin
      .post(apiPath('/likes'))
      .send({ targetType: 'post', targetId: dueId, action: 'LIKE' })
      .expect(404);

    await publisher.publishDue(new Date());
    await admin.get(apiPath(`/posts/${number}`)).expect(200);
    expect(await feedNumbers()).toContain(number);
  });

  it('рядок, який тримає інший воркер, — пропускає, не чекаючи; той його й публікує, подія — від нього, не від нас', async () => {
    const now = new Date();
    const [heldId, ...freeIds] = await insertScheduledPosts(
      3,
      new Date(now.getTime() - HOUR_MS),
    );

    // Інший воркер посеред свого запису: рядок оновлено й заблоковано до коміту
    const { result: publishedCount, wasBlocked } = await whileLocked(
      (tx) =>
        tx.$executeRaw`UPDATE "Post" SET "status" = 'PUBLISHED' WHERE "id" = ${heldId}`,
      () => publisher.publishDue(now),
    );

    expect(wasBlocked).toBe(false);
    expect(publishedCount).toBe(freeIds.length);
    expect(await publisher.publishDue(now)).toBe(0);
    expect(await statusOf(heldId)).toBe(PostStatus.PUBLISHED);
    expect(eventsOf(heldId)).toEqual([]);
    for (const freeId of freeIds) {
      expect(eventsOf(freeId)).toEqual([
        { name: POST_PUBLISHED_EVENT, slug: 'scheduled-news' },
      ]);
    }
  });

  it('два паралельні проходи — кожна новина опублікована й подія надіслана один раз', async () => {
    const now = new Date();
    const dueIds = await insertScheduledPosts(
      SCHEDULED_POST_BATCH_SIZE + 50,
      new Date(now.getTime() - HOUR_MS),
    );

    const counts = await Promise.all([
      publisher.publishDue(now),
      publisher.publishDue(now),
    ]);

    expect(counts[0] + counts[1]).toBe(dueIds.length);
    expect(receivedEvents.map((event) => event.post.id).sort()).toEqual(
      [...dueIds].sort(),
    );
  });

  it('«Publish now», поки воркер публікує ту саму новину, — чекає на рядок і події не шле: публікація одна', async () => {
    const scheduledAt = new Date(Date.now() - HOUR_MS);
    const [postId] = await insertScheduledPosts(1, scheduledAt);

    const { result: response, wasBlocked } = await whileLocked(
      (tx) =>
        tx.$executeRaw`UPDATE "Post" SET "status" = 'PUBLISHED' WHERE "id" = ${postId}`,
      () => updatePost(postId, { status: 'PUBLISHED' }).then((res) => res),
    );

    expect(wasBlocked).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: scheduledAt.toISOString(),
      isLive: true,
    });
    expect(eventsOf(postId)).toEqual([]);
  });

  it('редактор публікує раніше за воркера — воркер рядок пропускає, подія одна (від редактора)', async () => {
    const now = new Date();
    const [postId] = await insertScheduledPosts(
      1,
      new Date(now.getTime() - HOUR_MS),
    );

    // Редактор тримає рядок (`lockEditState`): воркер не чекає й не публікує
    const { result: countWhileEditing, wasBlocked } = await whileLocked(
      (tx) =>
        tx.$queryRaw`SELECT "id" FROM "Post" WHERE "id" = ${postId} FOR NO KEY UPDATE`,
      () => publisher.publishDue(now),
    );
    expect(wasBlocked).toBe(false);
    expect(countWhileEditing).toBe(0);

    await updatePost(postId, { status: 'PUBLISHED' }).expect(200);
    expect(await publisher.publishDue(now)).toBe(0);
    expect(eventsOf(postId)).toEqual([
      { name: POST_PUBLISHED_EVENT, slug: 'scheduled-news' },
    ]);
  });

  it('події редактора: з’явилась — published; змінилась для читача (текст, переклад, slug) — updated; зникла — unpublished; решта — без подій', async () => {
    const live = await createPost({ status: 'PUBLISHED' });
    const draft = await createPost({});
    expect(eventsOf(live.id)).toEqual([
      { name: POST_PUBLISHED_EVENT, slug: live.slug },
    ]);

    // Чернетка ↔ запланована й перенесення дати — на сайті нічого не змінилось
    const tomorrow = new Date(Date.now() + DAY_MS).toISOString();
    await updatePost(draft.id, {
      status: 'SCHEDULED',
      publishedAt: tomorrow,
    }).expect(200);
    await updatePost(draft.id, {
      publishedAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
    }).expect(200);
    await updatePost(draft.id, {
      translations: [{ ...POST_EN, title: 'Arsenal sign a striker' }],
    }).expect(200);
    expect(eventsOf(draft.id)).toEqual([]);
    await updatePost(draft.id, { status: 'PUBLISHED' }).expect(200);
    // Slug запланованої зафіксовано (D24): новий заголовок адресу не змінив
    expect(eventsOf(draft.id)).toEqual([
      { name: POST_PUBLISHED_EVENT, slug: draft.slug },
    ]);
    // Подія — після коміту транзакції: підписник бачить новину вже опублікованою
    expect(await receivedEvents.at(-1)?.statusSeen).toBe(PostStatus.PUBLISHED);

    // Жива: те саме ще раз — без події; текст, новий переклад, новий slug (стара адреса — 308) — `post.updated`
    await updatePost(live.id, { translations: [POST_EN] }).expect(200);
    await updatePost(live.id, {
      translations: [
        { ...POST_EN, excerpt: 'A stoppage-time winner settled it.' },
      ],
    }).expect(200);
    await updatePost(live.id, { translations: [POST_UK] }).expect(200);
    await updatePost(live.id, { slug: 'derby-report' }).expect(200);
    await updatePost(live.id, { status: 'ARCHIVED' }).expect(200);
    await updatePost(live.id, { status: 'PUBLISHED' }).expect(200);
    await admin.delete(apiPath(`/posts/${live.id}`)).expect(200);
    expect(eventsOf(live.id)).toEqual([
      { name: POST_PUBLISHED_EVENT, slug: live.slug },
      { name: POST_UPDATED_EVENT, slug: live.slug },
      { name: POST_UPDATED_EVENT, slug: live.slug },
      { name: POST_UPDATED_EVENT, slug: 'derby-report' },
      { name: POST_UNPUBLISHED_EVENT, slug: 'derby-report' },
      { name: POST_PUBLISHED_EVENT, slug: 'derby-report' },
      { name: POST_UNPUBLISHED_EVENT, slug: 'derby-report' },
    ]);

    const deletedDraft = await createPost({});
    await admin.delete(apiPath(`/posts/${deletedDraft.id}`)).expect(200);
    expect(eventsOf(deletedDraft.id)).toEqual([]);
  });

  it('дата опублікованої незмінна: інша дата чи SCHEDULED → 400 PUBLISHED_AT_LOCKED; та сама дата — 200', async () => {
    const publishedAt = new Date(Date.now() - DAY_MS).toISOString();
    const post = await createPost({ status: 'PUBLISHED', publishedAt });

    for (const fields of [
      { publishedAt: new Date(Date.now() - 2 * DAY_MS).toISOString() },
      {
        status: 'SCHEDULED',
        publishedAt: new Date(Date.now() + DAY_MS).toISOString(),
      },
    ]) {
      const response = await updatePost(post.id, fields).expect(400);
      expectMatchesContract(response, 'put', '/posts/{id}');
      expect(response.body).toMatchObject({ message: 'PUBLISHED_AT_LOCKED' });
    }
    const sameDate = await updatePost(post.id, {
      status: 'PUBLISHED',
      publishedAt,
    }).expect(200);
    expect(sameDate.body).toMatchObject({ publishedAt, status: 'PUBLISHED' });
  });
});
