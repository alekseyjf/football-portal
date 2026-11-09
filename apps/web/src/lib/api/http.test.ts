import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiGet, apiPost } from './http';

const PUBLIC_POST = {
  cache: 'public',
  tags: ['post:42'],
  revalidate: 3600,
} as const;

describe('Кеш даних Next для запитів до API (M1.8.3)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function lastFetchInit(): RequestInit & { next?: unknown } {
    return fetchMock.mock.calls.at(-1)?.[1] as RequestInit & { next?: unknown };
  }

  beforeEach(() => {
    fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('публічний на сервері — у кеш з тегами й TTL, без `no-store`', async () => {
    await apiGet('/posts/42?lang=en', PUBLIC_POST);
    const init = lastFetchInit();
    expect(init.next).toEqual({ tags: ['post:42'], revalidate: 3600 });
    expect(init.cache).toBeUndefined();
  });

  it('за замовчуванням і мутації — `no-store`, без тегів', async () => {
    await apiGet('/auth/me');
    expect(lastFetchInit()).toMatchObject({ cache: 'no-store' });
    expect(lastFetchInit().next).toBeUndefined();

    await apiPost('/likes', { targetType: 'post' });
    expect(lastFetchInit()).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(lastFetchInit().next).toBeUndefined();
  });

  it.each(['Cookie', 'authorization'])(
    'публічний з заголовком %s — помилка до запиту: персональна відповідь у спільний кеш не потрапить',
    (header) => {
      expect(() =>
        apiFetch(
          '/posts/42?lang=en',
          { method: 'GET', headers: { [header]: 'access_token=secret' } },
          PUBLIC_POST,
        ),
      ).toThrow(/must not send/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('у браузері кешу даних Next немає — і публічний `no-store`', async () => {
    vi.stubGlobal('window', {});
    await apiGet('/posts/42?lang=en', PUBLIC_POST);
    expect(lastFetchInit()).toMatchObject({ cache: 'no-store' });
    expect(lastFetchInit().next).toBeUndefined();
  });
});

describe('Куди йде запит: браузер — через сайт, SSR — на API з секретом (D59)', () => {
  const ORIGIN_SECRET = 'origin-secret-origin-secret-origin-secret';
  let fetchMock: ReturnType<typeof vi.fn>;

  function lastFetch(): { url: string; headers: Headers } {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return { url, headers: new Headers(init.headers) };
  }

  beforeEach(() => {
    fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_ORIGIN', 'https://api.example.onrender.com');
    vi.stubEnv('API_ORIGIN_SECRET', ORIGIN_SECRET);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('сервер — API напряму з секретом сайту', async () => {
    await apiGet('/posts/home?lang=uk');
    const { url, headers } = lastFetch();
    expect(url).toBe(
      'https://api.example.onrender.com/api/v1/posts/home?lang=uk',
    );
    expect(headers.get('x-origin-secret')).toBe(ORIGIN_SECRET);
  });

  it('браузер — свій домен (/api/v1), без секрету й адреси API, навіть якщо змінні є', async () => {
    vi.stubGlobal('window', {});
    await apiPost('/likes', { targetType: 'post' });
    const { url, headers } = lastFetch();
    expect(url).toBe('/api/v1/likes');
    expect(headers.has('x-origin-secret')).toBe(false);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('локально без змінних — API на localhost без секрету', async () => {
    vi.stubEnv('API_ORIGIN', '');
    vi.stubEnv('API_ORIGIN_SECRET', '');
    await apiGet('/football/leagues');
    const { url, headers } = lastFetch();
    expect(url).toBe('http://localhost:4000/api/v1/football/leagues');
    expect(headers.has('x-origin-secret')).toBe(false);
  });
});

describe('SSR не йде за редиректом: секрет сайту не піде на адресу з `Location` (D59)', () => {
  const ORIGIN_SECRET = 'origin-secret-origin-secret-origin-secret';
  const servers: Server[] = [];

  /** Справжній HTTP-сервер (`fetch` — справжній, не мок): редирект виконує сам `fetch`. */
  async function listen(handler: RequestListener): Promise<string> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });

  it('API відповіло 3xx — запит падає, чужий сервер не отримує жодного запиту з секретом', async () => {
    const secretsReceived: (string | undefined)[] = [];
    const foreignOrigin = await listen((req, res) => {
      secretsReceived.push(
        req.headers['x-origin-secret'] as string | undefined,
      );
      res.end('{}');
    });
    const apiOrigin = await listen((_req, res) => {
      res.writeHead(302, { Location: `${foreignOrigin}/collect` }).end();
    });
    vi.stubEnv('API_ORIGIN', apiOrigin);
    vi.stubEnv('API_ORIGIN_SECRET', ORIGIN_SECRET);

    await expect(apiGet('/posts/home?lang=uk')).rejects.toThrow(TypeError);
    // Виклик його не перевизначить: в `apiFetch` `redirect` стоїть після `...init`
    await expect(
      apiFetch(
        '/posts/home?lang=uk',
        { method: 'GET', redirect: 'follow' },
        { cache: 'private' },
      ),
    ).rejects.toThrow(TypeError);
    expect(secretsReceived).toEqual([]);
  });
});
