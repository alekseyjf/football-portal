import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { apiPath, createE2eApp, type E2eApp } from '../support/e2e-app';
import { resetE2eData } from '../support/e2e-database';

const ORIGIN_SECRET = 'origin-secret-origin-secret-origin-secret';
const SITE_ORIGIN = 'https://site.example';
/** Ліміт входу з одного IP — 10 за хвилину (`LoginThrottle`) */
const LOGIN_ATTEMPTS_PER_IP = 10;

/*
 * Шлюз API (M1.11.3, D59) і CSRF (D60) — на справжньому застосунку з налаштуваннями тест-сервера: API за Render
 * приймає лише сервери web і адмінки (секрет), IP браузера бере з їхнього заголовка, мутації — лише зі свого сайту.
 */
describe('Шлюз API на тест-сервері (D59)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp({
      envOverrides: {
        NODE_ENV: 'production',
        APP_ENV: 'test',
        TRUST_PROXY: 'false',
        CORS_ORIGINS: SITE_ORIGIN,
        API_ORIGIN_SECRET: ORIGIN_SECRET,
      },
    });
    await resetE2eData(e2e.prisma);
  });
  afterAll(() => e2e.close());

  function loginFromBrowser(clientIp: string) {
    return request(e2e.app.getHttpServer())
      .post(apiPath('/auth/login'))
      .set('x-origin-secret', ORIGIN_SECRET)
      .set('x-client-ip', clientIp)
      .send({
        email: `nobody-${randomUUID()}@example.test`,
        password: 'wrong-password',
      });
  }

  it('без секрету — 403 на все, крім /health; з чужим секретом — теж; з правильним — працює', async () => {
    const server = e2e.app.getHttpServer();
    await request(server).get(apiPath('/health')).expect(200);

    for (const secretHeader of [
      {},
      { 'x-origin-secret': `${ORIGIN_SECRET}x` },
    ]) {
      const response = await request(server)
        .get(apiPath('/football/leagues'))
        // Підроблений IP нічого не дає: без секрету запит далі не йде
        .set({ ...secretHeader, 'X-Forwarded-For': '198.51.100.1' })
        .expect(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'DIRECT_API_ACCESS_FORBIDDEN',
      });
    }

    await request(server)
      .get(apiPath('/football/leagues'))
      .set('x-origin-secret', ORIGIN_SECRET)
      .expect(200);
  });

  it('Swagger на тесті є, але лише через сайт (з секретом); відповіді API — noindex', async () => {
    const server = e2e.app.getHttpServer();
    await request(server).get('/api/docs').expect(403);
    const docs = await request(server)
      .get('/api/docs-json')
      .set('x-origin-secret', ORIGIN_SECRET)
      .expect(200);
    expect(docs.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('IP браузера — від сервера сайту: у сесії він, а ліміт входу в кожного IP свій', async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_IP; attempt++) {
      await loginFromBrowser('203.0.113.10').expect(401);
    }
    await loginFromBrowser('203.0.113.10').expect(429);
    // Інший відвідувач того самого сайту ліміт першого не ділить
    await loginFromBrowser('203.0.113.20').expect(401);

    const email = `fan-${randomUUID()}@example.test`;
    const password = 'e2e-password-1';
    await request(e2e.app.getHttpServer())
      .post(apiPath('/auth/register'))
      .set('x-origin-secret', ORIGIN_SECRET)
      .send({ email, name: 'Fan', password })
      .expect(201);
    await request(e2e.app.getHttpServer())
      .post(apiPath('/auth/login'))
      .set('x-origin-secret', ORIGIN_SECRET)
      .set('x-client-ip', '2001:db8::7')
      .send({ email, password })
      .expect(200);
    const session = await e2e.prisma.authSession.findFirstOrThrow({
      where: { user: { email } },
      select: { ipAddress: true },
    });
    expect(session.ipAddress).toBe('2001:db8::7');
  });
});

describe('Ротація секрету шлюзу (D59): старий діє, поки web і адмінка не перейшли на новий', () => {
  const PREVIOUS_SECRET = 'previous-origin-secret-previous-origin-secret';
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp({
      envOverrides: {
        NODE_ENV: 'production',
        APP_ENV: 'test',
        TRUST_PROXY: 'false',
        CORS_ORIGINS: SITE_ORIGIN,
        API_ORIGIN_SECRET: ORIGIN_SECRET,
        API_ORIGIN_SECRET_PREVIOUS: PREVIOUS_SECRET,
      },
    });
    await resetE2eData(e2e.prisma);
  });
  afterAll(() => e2e.close());

  it('новий і старий секрет — 200, будь-який інший — 403', async () => {
    for (const secret of [ORIGIN_SECRET, PREVIOUS_SECRET]) {
      await request(e2e.app.getHttpServer())
        .get(apiPath('/football/leagues'))
        .set('x-origin-secret', secret)
        .expect(200);
    }
    const response = await request(e2e.app.getHttpServer())
      .get(apiPath('/football/leagues'))
      .set('x-origin-secret', `${PREVIOUS_SECRET}x`)
      .expect(403);
    expect(response.body).toMatchObject({
      message: 'DIRECT_API_ACCESS_FORBIDDEN',
    });
  });
});

describe('CSRF: мутації лише зі свого сайту й лише JSON (D60)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp({ envOverrides: { CORS_ORIGINS: SITE_ORIGIN } });
  });
  afterAll(() => e2e.close());

  function logout() {
    return request(e2e.app.getHttpServer()).post(apiPath('/auth/logout'));
  }

  it('сторінка чужого сайту — 403 до контролера (Fetch Metadata чи Origin); свій сайт і не браузер — 200', async () => {
    for (const response of [
      await logout().set('Sec-Fetch-Site', 'cross-site').expect(403),
      await logout().set('Origin', 'https://evil.example').expect(403),
    ]) {
      expect(response.body).toMatchObject({
        message: 'CROSS_SITE_REQUEST_FORBIDDEN',
      });
    }
    await logout()
      .set('Origin', SITE_ORIGIN)
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(200);
    await logout().expect(200);
  });

  it('тіло не JSON (форма, text/plain) — 415, навіть зі свого сайту', async () => {
    const response = await request(e2e.app.getHttpServer())
      .post(apiPath('/auth/login'))
      .set('Origin', SITE_ORIGIN)
      .set('Content-Type', 'text/plain')
      .send('{"email":"fan@example.test","password":"x"}')
      .expect(415);
    expect(response.body).toMatchObject({ message: 'UNSUPPORTED_MEDIA_TYPE' });
    await request(e2e.app.getHttpServer())
      .post(apiPath('/auth/login'))
      .type('form')
      .send({ email: 'fan@example.test', password: 'x' })
      .expect(415);
  });

  it('читання з чужого сайту не перевіряється: GET нічого не змінює', async () => {
    await request(e2e.app.getHttpServer())
      .get(apiPath('/football/leagues'))
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(200);
  });
});
