import {
  RateLimitAction,
  Role,
  SanctionReason,
  SanctionType,
  UserStatus,
} from '@prisma/client';
import type request from 'supertest';
import { getRateLimitPolicy } from '../../src/security/abuse.constants';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, loginAs, type E2eUser } from '../support/e2e-auth';
import { publishPost } from '../support/e2e-content';
import { resetE2eData } from '../support/e2e-database';

const DAY_MS = 24 * 60 * 60 * 1_000;
const LIKE_BURST_THRESHOLD = getRateLimitPolicy(
  RateLimitAction.LIKE,
  0,
).burstThreshold;

interface PastSanction {
  daysAgo: number;
  type?: SanctionType;
  revoked?: boolean;
}

/**
 * Strike анти-абузу — невідкликана санкція того самого типу за останні 30 днів (D37):
 * давній «вибух» лайків не робить новий блоком акаунта. Межа — 29 і 31 день: точну мить
 * «рівно 30 днів» запит не відтворить (час іде між засівом і burst-ом).
 */
describe('Анти-абуз: strike-и лише за останні 30 днів', () => {
  let e2e: E2eApp;
  let postId: string;

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    const admin = await loginAs(e2e, await createUser(e2e, Role.ADMIN));
    postId = (await publishPost(admin)).id;
  });
  afterAll(() => e2e.close());

  /** Санкція за burst, видана `daysAgo` днів тому: 24 год бану давно минули. */
  async function seedPastSanction(
    user: E2eUser,
    {
      daysAgo,
      type = SanctionType.LIKES_SUSPENDED,
      revoked = false,
    }: PastSanction,
  ): Promise<void> {
    const startsAt = new Date(Date.now() - daysAgo * DAY_MS);
    await e2e.prisma.userSanction.create({
      data: {
        userId: user.id,
        type,
        reason:
          type === SanctionType.LIKES_SUSPENDED
            ? SanctionReason.LIKE_BURST
            : SanctionReason.COMMENT_BURST,
        startsAt,
        endsAt: new Date(startsAt.getTime() + DAY_MS),
        revokedAt: revoked ? new Date(startsAt.getTime() + DAY_MS / 2) : null,
      },
    });
  }

  /** Лайки один за одним: до порогу — 201, на порозі — відповідь burst-у. */
  async function likeBurst(fan: request.Agent): Promise<request.Response> {
    const like = () =>
      fan
        .post(apiPath('/likes'))
        .send({ targetType: 'post', targetId: postId, action: 'LIKE' });
    for (let attempt = 1; attempt < LIKE_BURST_THRESHOLD; attempt++) {
      await like().expect(201);
    }
    return like();
  }

  function sanctionsOf(user: E2eUser) {
    return e2e.prisma.userSanction.findMany({
      where: { userId: user.id },
      select: { type: true, reason: true, issuedById: true, note: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  async function statusOf(user: E2eUser): Promise<UserStatus> {
    const row = await e2e.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { status: true },
    });
    return row.status;
  }

  it('strike 31-денної давності не рахується: новий burst — лише бан лайків, акаунт і сесія живі', async () => {
    const user = await createUser(e2e);
    await seedPastSanction(user, { daysAgo: 31 });
    const fan = await loginAs(e2e, user);

    const burst = await likeBurst(fan);

    expect(burst.status).toBe(403);
    expect(burst.body).toMatchObject({ message: 'LIKES_SUSPENDED' });
    expect(await statusOf(user)).toBe(UserStatus.ACTIVE);
    expect((await sanctionsOf(user)).map((row) => row.type)).toEqual([
      SanctionType.LIKES_SUSPENDED,
      SanctionType.LIKES_SUSPENDED,
    ]);
    const me = await fan.get(apiPath('/auth/me')).expect(200);
    expect(me.body).toMatchObject({ user: { id: user.id } });
  });

  it('strike 29-денної давності рахується: другий strike блокує акаунт і гасить сесію', async () => {
    const user = await createUser(e2e);
    await seedPastSanction(user, { daysAgo: 29 });
    const fan = await loginAs(e2e, user);

    const burst = await likeBurst(fan);

    expect(burst.status).toBe(403);
    expect(burst.body).toMatchObject({ message: 'ACCOUNT_LOCKED' });
    expect(await statusOf(user)).toBe(UserStatus.LOCKED);
    expect(await sanctionsOf(user)).toEqual([
      expect.objectContaining({ type: SanctionType.LIKES_SUSPENDED }),
      expect.objectContaining({ type: SanctionType.LIKES_SUSPENDED }),
      {
        type: SanctionType.ACCOUNT_LOCKED,
        reason: SanctionReason.LIKE_BURST,
        issuedById: null,
        note: '2 × LIKES_SUSPENDED',
      },
    ]);
    await fan.get(apiPath('/auth/me')).expect(401);
    const relogin = await fan
      .post(apiPath('/auth/login'))
      .send({ email: user.email, password: user.password })
      .expect(403);
    expect(relogin.body).toMatchObject({ message: 'ACCOUNT_LOCKED' });
  });

  it('strike — лише невідкликана санкція того самого типу: відкликана й бан коментарів за 30 днів не рахуються', async () => {
    const user = await createUser(e2e);
    await seedPastSanction(user, { daysAgo: 3, revoked: true });
    await seedPastSanction(user, {
      daysAgo: 2,
      type: SanctionType.COMMENTS_SUSPENDED,
    });
    const fan = await loginAs(e2e, user);

    const burst = await likeBurst(fan);

    expect(burst.status).toBe(403);
    expect(burst.body).toMatchObject({ message: 'LIKES_SUSPENDED' });
    expect(await statusOf(user)).toBe(UserStatus.ACTIVE);
  });
});
