import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import proxy from './proxy';

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
    ['/ua/matches?date=2026-10-10&league=CL', '/uk/matches?date=2026-10-10&league=CL'],
    // next-intl приймає локаль у будь-якому регістрі (`/EN` → `/en`), тож `/UA/…` колись працювало
    ['/UA/news/some-post', '/uk/news/some-post'],
  ])('%s → 308 на %s', (path, target) => {
    const response = proxy(requestTo(path));
    expect(response.status).toBe(308);
    expect(redirectTarget(response)).toBe(target);
  });

  // 308 віддає лише цей редирект; next-intl редиректить з 307
  it.each(['/uaxyz', '/en/ua', '/uk/news/ua'])('%s — не старий сегмент', (path) => {
    expect(proxy(requestTo(path)).status).not.toBe(308);
  });
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
