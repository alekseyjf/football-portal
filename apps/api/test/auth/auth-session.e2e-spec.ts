import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { createUser, readSetCookie, type E2eUser } from '../support/e2e-auth';
import { resetE2eData } from '../support/e2e-database';
import { expectMatchesContract } from '../support/openapi-contract';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

describe('Сесія: GET /auth/me без зайвих запитів гостя (M1.3.4)', () => {
  let e2e: E2eApp;
  let user: E2eUser;

  function server() {
    return request(e2e.app.getHttpServer());
  }

  /** Логін — як браузер, що потім шле cookies вибірково. */
  async function login() {
    const response = await server()
      .post(apiPath('/auth/login'))
      .send({ email: user.email, password: user.password })
      .expect(200);
    expectMatchesContract(response, 'post', '/auth/login');
    return {
      accessToken: readSetCookie(response, ACCESS_COOKIE),
      refreshToken: readSetCookie(response, REFRESH_COOKIE),
    };
  }

  function getMe(cookies: Record<string, string> = {}) {
    const cookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    const meRequest = server().get(apiPath('/auth/me'));
    return cookieHeader ? meRequest.set('Cookie', cookieHeader) : meRequest;
  }

  beforeAll(async () => {
    e2e = await createE2eApp();
    await resetE2eData(e2e.prisma);
    user = await createUser(e2e);
  });
  afterAll(() => e2e.close());

  it('гість без cookies → 200 { user: null } одразу, без 401 і refresh; не кешується', async () => {
    const response = await getMe().expect(200);
    expect(response.body).toEqual({ user: null });
    expect(response.headers['cache-control']).toContain('no-store');
    expectMatchesContract(response, 'get', '/auth/me');
  });

  it('жива сесія → поточний користувач з email', async () => {
    const { accessToken } = await login();
    const response = await getMe({ [ACCESS_COOKIE]: accessToken }).expect(200);
    expect(response.body).toMatchObject({
      user: { id: user.id, email: user.email, role: 'USER' },
    });
    expectMatchesContract(response, 'get', '/auth/me');
  });

  it('access-cookie вже немає, а refresh є → 401; refresh відновлює сесію, і me — користувач', async () => {
    const { refreshToken } = await login();
    const meResponse = await getMe({ [REFRESH_COOKIE]: refreshToken }).expect(
      401,
    );
    expectMatchesContract(meResponse, 'get', '/auth/me');

    const refreshResponse = await server()
      .post(apiPath('/auth/refresh'))
      .set('Cookie', `${REFRESH_COOKIE}=${refreshToken}`)
      .expect(200);
    expectMatchesContract(refreshResponse, 'post', '/auth/refresh');

    const response = await getMe({
      [ACCESS_COOKIE]: readSetCookie(refreshResponse, ACCESS_COOKIE),
    }).expect(200);
    expect(response.body).toMatchObject({ user: { id: user.id } });
  });

  it('недійсний access без refresh-cookie (сесії завершено) → гість, а не 401', async () => {
    const { accessToken } = await login();
    const logoutAllResponse = await server()
      .post(apiPath('/auth/logout-all'))
      .set('Cookie', `${ACCESS_COOKIE}=${accessToken}`)
      .expect(200);
    expectMatchesContract(logoutAllResponse, 'post', '/auth/logout-all');

    const response = await getMe({ [ACCESS_COOKIE]: accessToken }).expect(200);
    expect(response.body).toEqual({ user: null });
  });

  it('реєстрація, помилки й logout — за контрактом', async () => {
    const registered = await server()
      .post(apiPath('/auth/register'))
      .send({
        email: `fan-${Date.now()}@example.test`,
        name: 'Fan',
        password: user.password,
      })
      .expect(201);
    expectMatchesContract(registered, 'post', '/auth/register');

    const wrongPassword = await server()
      .post(apiPath('/auth/login'))
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);
    expectMatchesContract(wrongPassword, 'post', '/auth/login');

    const duplicateEmail = await server()
      .post(apiPath('/auth/register'))
      .send({ email: user.email, name: 'Duplicate', password: user.password })
      .expect(409);
    expectMatchesContract(duplicateEmail, 'post', '/auth/register');

    const logoutResponse = await server()
      .post(apiPath('/auth/logout'))
      .expect(200);
    expectMatchesContract(logoutResponse, 'post', '/auth/logout');
  });
});
