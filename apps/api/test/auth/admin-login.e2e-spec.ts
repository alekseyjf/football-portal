import { Role } from '@prisma/client';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import {
  createUser,
  loginAs,
  readSetCookieAttributes,
  type E2eUser,
} from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

/*
 * P2-29: роль перевіряється після пароля (без нього роль не розкриваємо) і до `endSession` / `startSession`
 * (не-адмін не отримує cookies і не втрачає сесії сайту). Спроб входу у файлі — 7 (з невалідним тілом:
 * throttler рахує запит до валідації); `login` і `login/admin` ділять ліміт — 10 за хвилину з IP, сам
 * спільний ліміт тут не перевіряємо.
 */

interface Credentials {
  email: unknown;
  password: unknown;
}

describe('POST /auth/login/admin: вхід в адмінку лише для ADMIN', () => {
  let e2e: E2eApp;
  let user: E2eUser;
  let admin: E2eUser;

  /** Від гостя або з браузера, що вже має cookies сайту (агент). */
  function adminLogin(
    credentials: Credentials,
    client: request.Agent | ReturnType<typeof request> = request(
      e2e.app.getHttpServer(),
    ),
  ) {
    return client.post(apiPath('/auth/login/admin')).send(credentials);
  }

  function sessionsOf(userId: string) {
    return e2e.prisma.authSession.findMany({
      where: { userId },
      select: { id: true, revokedAt: true },
      orderBy: { id: 'asc' },
    });
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    user = await createUser(e2e);
    admin = await createUser(e2e, Role.ADMIN);
  });
  afterAll(() => e2e.close());

  it('пароль перевіряється раніше за роль: невідомий email, хибний пароль USER (не 403 — роль не розкриваємо) і ADMIN → 401', async () => {
    const attempts: Credentials[] = [
      { email: 'nobody@example.test', password: user.password },
      { email: user.email, password: 'wrong-password' },
      { email: admin.email, password: 'wrong-password' },
    ];
    for (const credentials of attempts) {
      const response = await adminLogin(credentials).expect(401);
      expectMatchesContract(response, 'post', '/auth/login/admin');
      expect(response.body).toMatchObject({ message: 'Invalid credentials' });
    }
  });

  it('USER з правильним паролем → 403 ADMIN_ONLY: без cookies і нової сесії, сесія сайту лишається', async () => {
    const site = await loginAs(e2e, user);
    const sessionsBefore = await sessionsOf(user.id);
    expect(sessionsBefore).toHaveLength(1);
    expect(sessionsBefore[0].revokedAt).toBeNull();

    const response = await adminLogin(
      { email: user.email, password: user.password },
      site,
    ).expect(403);
    expectMatchesContract(response, 'post', '/auth/login/admin');
    expect(response.body).toMatchObject({ message: 'ADMIN_ONLY' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await sessionsOf(user.id)).toEqual(sessionsBefore);
  });

  it('ADMIN → 200: користувач, сесія й httpOnly cookies; відповідь не кешується', async () => {
    const response = await adminLogin({
      email: admin.email,
      password: admin.password,
    }).expect(200);
    expectMatchesContract(response, 'post', '/auth/login/admin');
    expect(response.body).toMatchObject({
      user: { id: admin.id, role: Role.ADMIN },
    });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(readSetCookieAttributes(response, 'access_token')).toEqual(
      expect.arrayContaining(['Path=/', 'HttpOnly', 'SameSite=Lax']),
    );
    // Refresh-cookie — лише на `/auth/*` (refresh, logout, me), не на кожен запит
    expect(readSetCookieAttributes(response, 'refresh_token')).toEqual(
      expect.arrayContaining([
        `Path=${apiPath('/auth')}`,
        'HttpOnly',
        'SameSite=Lax',
      ]),
    );
    const sessions = await sessionsOf(admin.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revokedAt).toBeNull();
  });

  it('невалідне тіло → 400', async () => {
    const response = await adminLogin({
      email: 'not-an-email',
      password: 42,
    }).expect(400);
    expectMatchesContract(response, 'post', '/auth/login/admin');
  });
});
