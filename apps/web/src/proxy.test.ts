import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import proxy, { config } from './proxy';

const ORIGIN = 'http://localhost:3000';

function requestTo(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

function redirectTarget(response: Response): string | null {
  const location = response.headers.get('location');
  if (!location) return null;
  const url = new URL(location, ORIGIN);
  return `${url.pathname}${url.search}`;
}

describe('proxy: старий сегмент української /ua/… (D22)', () => {
  it.each([
    ['/ua', '/uk'],
    ['/ua/news/some-post', '/uk/news/some-post'],
    [
      '/ua/matches?date=2026-10-10&league=CL',
      '/uk/matches?date=2026-10-10&league=CL',
    ],
    // next-intl приймає локаль у будь-якому регістрі (`/EN` → `/en`), тож `/UA/…` колись працювало
    ['/UA/news/some-post', '/uk/news/some-post'],
  ])('%s → 308 на %s', (path, target) => {
    const response = proxy(requestTo(path));
    expect(response.status).toBe(308);
    expect(redirectTarget(response)).toBe(target);
  });

  // 308 віддає лише цей редирект; next-intl редиректить з 307
  it.each(['/uaxyz', '/en/ua', '/uk/news/ua'])(
    '%s — не старий сегмент',
    (path) => {
      expect(proxy(requestTo(path)).status).not.toBe(308);
    },
  );
});

describe('proxy: мова з браузера', () => {
  it('Accept-Language uk-UA → /uk без нормалізації заголовка', () => {
    const response = proxy(
      requestTo('/', { 'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8' }),
    );
    expect(redirectTarget(response)).toBe('/uk');
  });

  it('стара cookie NEXT_LOCALE=ua не ламає вибір мови — береться з браузера', () => {
    const response = proxy(
      requestTo('/', { 'accept-language': 'uk', cookie: 'NEXT_LOCALE=ua' }),
    );
    expect(redirectTarget(response)).toBe('/uk');
  });
});

describe('proxy: які адреси проходять (matcher, M1.8.3)', () => {
  function passesProxy(path: string): boolean {
    return unstable_doesMiddlewareMatch({
      config,
      url: new URL(path, ORIGIN).href,
    });
  }

  it.each([
    '/',
    '/en',
    '/uk/news/slug-123',
    '/uk/news/top-10-42',
    '/en/news?tags=transfers&page=2',
    '/en/matches?date=2026-10-10',
    '/ua/news/some-post',
    '/en/og/post/42',
    '/en/api',
  ])('сторінка %s — проходить (мова, X-Robots-Tag)', (path) => {
    expect(passesProxy(path)).toBe(true);
  });

  it.each(['/api/v1/posts/home?lang=uk', '/api/v1/auth/login', '/api/docs'])(
    'шлюз до API %s — проходить (пароль тест-сервера, D59)',
    (path) => {
      expect(passesProxy(path)).toBe(true);
    },
  );

  it.each([
    '/api/revalidate',
    '/api/docs/swagger-ui.css',
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Fx.png&w=640&q=75',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemaps/static.xml',
    '/sitemaps/posts-2026-10.xml',
    '/sitemaps/news.xml',
  ])('%s — повз proxy: без мови в адресі', (path) => {
    expect(passesProxy(path)).toBe(false);
  });
});

describe('proxy: індексація сайту (SITE_INDEXING, M1.8.3)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, '', 'false', 'yes'])(
    'SITE_INDEXING=%j — сайт закритий: X-Robots-Tag: noindex, nofollow і на сторінці, і на редиректі',
    (value) => {
      vi.stubEnv('SITE_INDEXING', value);
      expect(proxy(requestTo('/en/news')).headers.get('X-Robots-Tag')).toBe(
        'noindex, nofollow',
      );
      expect(proxy(requestTo('/ua')).headers.get('X-Robots-Tag')).toBe(
        'noindex, nofollow',
      );
    },
  );

  it('SITE_INDEXING=true — без X-Robots-Tag', () => {
    vi.stubEnv('SITE_INDEXING', 'true');
    expect(proxy(requestTo('/en/news')).headers.has('X-Robots-Tag')).toBe(
      false,
    );
  });
});

describe('proxy: пароль тест-сервера (Basic Auth, M1.11.6)', () => {
  const PASSWORD = 'long-enough-password';

  function withPassword(path: string, user: string, password: string) {
    const encoded = Buffer.from(`${user}:${password}`).toString('base64');
    return requestTo(path, { authorization: `Basic ${encoded}` });
  }

  afterEach(() => vi.unstubAllEnvs());

  it('локально (APP_ENV не задано, не production) — без пароля', () => {
    expect(proxy(requestTo('/en/news')).status).not.toBe(401);
  });

  describe('APP_ENV=test', () => {
    beforeEach(() => {
      vi.stubEnv('APP_ENV', 'test');
      vi.stubEnv('BASIC_AUTH_USER', 'tester');
      vi.stubEnv('BASIC_AUTH_PASSWORD', PASSWORD);
    });

    it.each(['/en/news', '/', '/api/v1/auth/me', '/api/docs'])(
      '%s без пароля чи з хибним — 401 з викликом',
      (path) => {
        for (const request of [
          requestTo(path),
          withPassword(path, 'tester', 'wrong-password'),
        ]) {
          const response = proxy(request);
          expect(response.status).toBe(401);
          expect(response.headers.get('www-authenticate')).toMatch(/^Basic /);
        }
      },
    );

    it('з паролем — сторінка далі до мови, шлюз до API — без мови в адресі', () => {
      const page = proxy(withPassword('/', 'tester', PASSWORD));
      expect(redirectTarget(page)).toBe('/en');
      const api = proxy(withPassword('/api/v1/auth/me', 'tester', PASSWORD));
      expect(api.status).toBe(200);
      expect(redirectTarget(api)).toBeNull();
    });
  });

  it('production без APP_ENV — пароль потрібен: забута змінна не відкриває тест-сервер', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(proxy(requestTo('/en/news')).status).toBe(401);
    // Без облікових даних у змінних не пускає й «будь-який» пароль
    expect(proxy(withPassword('/en/news', '', '')).status).toBe(401);
  });
});
