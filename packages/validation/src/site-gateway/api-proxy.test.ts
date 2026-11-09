import { once } from 'node:events';
import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, ORIGIN_SECRET_HEADER } from '../api-access';
import { forwardToApi, isOriginSecretValid } from './api-proxy';

const ORIGIN_SECRET = 'origin-secret-origin-secret-origin-secret';

interface ReceivedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

let fakeApi: Server | undefined;

afterEach(async () => {
  if (!fakeApi) return;
  fakeApi.close();
  await once(fakeApi, 'close');
  fakeApi = undefined;
});

/** Фейковий API на випадковому порту: запам'ятовує запит і відповідає двома cookies сесії. */
async function startFakeApi(
  options: { delayMs?: number } = {},
): Promise<{ origin: string; received: ReceivedRequest[] }> {
  const received: ReceivedRequest[] = [];
  fakeApi = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      });
      setTimeout(() => {
        res.writeHead(201, [
          ['Content-Type', 'application/json'],
          ['Set-Cookie', 'access_token=a; Path=/; HttpOnly; SameSite=Lax'],
          [
            'Set-Cookie',
            'refresh_token=r; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
          ],
        ]);
        res.end(JSON.stringify({ ok: true }));
      }, options.delayMs ?? 0);
    });
  });
  fakeApi.listen(0, '127.0.0.1');
  await once(fakeApi, 'listening');
  const { port } = fakeApi.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${port}`, received };
}

function browserRequest(init: RequestInit & { headers?: HeadersInit } = {}) {
  return new Request('https://site.example/api/v1/auth/login?lang=uk', {
    method: 'POST',
    body: JSON.stringify({ email: 'fan@example.com' }),
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'tz=Europe%2FKyiv',
      Origin: 'https://site.example',
      'Sec-Fetch-Site': 'same-origin',
      'X-Forwarded-For': '203.0.113.7, 10.0.0.1',
      Authorization: 'Basic dGVzdDpzZWNyZXQ=',
      ...init.headers,
    },
  });
}

describe('forwardToApi — шлюз сайту до API (D59)', () => {
  it('шлях, query, метод і тіло — на API; секрет сервера й IP браузера додано; пароль сайту до API не йде', async () => {
    const api = await startFakeApi();
    await forwardToApi(browserRequest(), {
      apiOrigin: api.origin,
      originSecret: ORIGIN_SECRET,
    });

    const [received] = api.received;
    expect(received).toMatchObject({
      method: 'POST',
      url: '/api/v1/auth/login?lang=uk',
      body: JSON.stringify({ email: 'fan@example.com' }),
    });
    expect(received.headers).toMatchObject({
      'content-type': 'application/json',
      cookie: 'tz=Europe%2FKyiv',
      origin: 'https://site.example',
      'sec-fetch-site': 'same-origin',
      [ORIGIN_SECRET_HEADER]: ORIGIN_SECRET,
      [CLIENT_IP_HEADER]: '203.0.113.7',
    });
    expect(received.headers.authorization).toBeUndefined();
    expect(received.headers['x-forwarded-for']).toBeUndefined();
  });

  it('відповідь — зі статусом і кожним Set-Cookie окремо: сесія лягає на домен сайту', async () => {
    const api = await startFakeApi();
    const response = await forwardToApi(browserRequest(), {
      apiOrigin: api.origin,
      originSecret: ORIGIN_SECRET,
    });

    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual([
      'access_token=a; Path=/; HttpOnly; SameSite=Lax',
      'refresh_token=r; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
    ]);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('без секрету (локально) заголовка секрету немає; підроблений IP браузера не пересилається', async () => {
    const api = await startFakeApi();
    await forwardToApi(
      browserRequest({
        method: 'GET',
        body: null,
        headers: { 'X-Forwarded-For': 'not-an-ip' },
      }),
      { apiOrigin: api.origin, originSecret: undefined },
    );

    const [received] = api.received;
    expect(received.headers[ORIGIN_SECRET_HEADER]).toBeUndefined();
    expect(received.headers[CLIENT_IP_HEADER]).toBeUndefined();
  });

  it('API недоступне → 502, не встиг → 504: тіло — у форматі помилок API', async () => {
    const api = await startFakeApi({ delayMs: 500 });
    const late = await forwardToApi(
      browserRequest(),
      { apiOrigin: api.origin, originSecret: ORIGIN_SECRET },
      50,
    );
    expect(late.status).toBe(504);
    expect(await late.json()).toEqual({
      statusCode: 504,
      message: 'API_UNAVAILABLE',
    });

    const down = await forwardToApi(browserRequest(), {
      // Порт 1 закритий: з'єднання відхилено одразу
      apiOrigin: 'http://127.0.0.1:1',
      originSecret: ORIGIN_SECRET,
    });
    expect(down.status).toBe(502);
  });
});

describe('isOriginSecretValid — запит від сервера сайту (API)', () => {
  it('лише точний збіг; немає, порожній, інший чи довший — ні', () => {
    expect(isOriginSecretValid(ORIGIN_SECRET, ORIGIN_SECRET)).toBe(true);
    for (const provided of [
      undefined,
      '',
      ORIGIN_SECRET.slice(1),
      `${ORIGIN_SECRET} `,
    ]) {
      expect(isOriginSecretValid(provided, ORIGIN_SECRET)).toBe(false);
    }
  });
});
