import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import proxy, { config } from './proxy';

const ORIGIN = 'http://localhost:3001';
const PASSWORD = 'long-enough-password';

function requestTo(path: string, password?: string) {
  const headers: Record<string, string> = password
    ? { authorization: `Basic ${Buffer.from(`tester:${password}`).toString('base64')}` }
    : {};
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

describe('proxy адмінки: пароль тест-сервера (Basic Auth, M1.11.6)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(['/dashboard/posts', '/login', '/api/v1/auth/me'])(
    '%s — під паролем; robots.txt і статика — ні',
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` })).toBe(true);
    },
  );

  it.each(['/robots.txt', '/_next/static/chunks/main.js', '/favicon.ico'])('%s — повз proxy', (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` })).toBe(false);
  });

  it('локально (APP_ENV не задано, не production) — без пароля', () => {
    expect(proxy(requestTo('/dashboard')).status).toBe(200);
  });

  describe('APP_ENV=test', () => {
    beforeEach(() => {
      vi.stubEnv('APP_ENV', 'test');
      vi.stubEnv('BASIC_AUTH_USER', 'tester');
      vi.stubEnv('BASIC_AUTH_PASSWORD', PASSWORD);
    });

    it('без пароля чи з хибним — 401 з викликом; з паролем — далі', () => {
      for (const request of [requestTo('/dashboard'), requestTo('/dashboard', 'wrong-password')]) {
        const response = proxy(request);
        expect(response.status).toBe(401);
        expect(response.headers.get('www-authenticate')).toMatch(/^Basic /);
      }
      expect(proxy(requestTo('/api/v1/auth/me', PASSWORD)).status).toBe(200);
    });
  });
});
