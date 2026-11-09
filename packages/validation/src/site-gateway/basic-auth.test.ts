import { describe, expect, it } from 'vitest';
import { basicAuthChallenge, isBasicAuthorized } from './basic-auth';

const CREDENTIALS = { user: 'tester', password: 'pass:word with колон' };

function basicHeader(user: string, password: string, scheme = 'Basic') {
  return `${scheme} ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

describe('Basic Auth тест-сервера (M1.11.6)', () => {
  it('правильні логін і пароль — так; пароль з «:» і кирилицею, схема в будь-якому регістрі', () => {
    expect(
      isBasicAuthorized(
        basicHeader(CREDENTIALS.user, CREDENTIALS.password),
        CREDENTIALS,
      ),
    ).toBe(true);
    expect(
      isBasicAuthorized(
        basicHeader(CREDENTIALS.user, CREDENTIALS.password, 'basic'),
        CREDENTIALS,
      ),
    ).toBe(true);
  });

  it('хибний пароль чи логін, інша схема, зіпсований заголовок, немає заголовка — ні', () => {
    for (const authorization of [
      basicHeader(CREDENTIALS.user, 'wrong-password'),
      basicHeader('admin', CREDENTIALS.password),
      basicHeader(CREDENTIALS.user, CREDENTIALS.password, 'Bearer'),
      `Basic ${Buffer.from('no-separator').toString('base64')}`,
      'Basic',
      null,
    ]) {
      expect(isBasicAuthorized(authorization, CREDENTIALS)).toBe(false);
    }
  });

  it('без облікових даних (невалідні змінні тесту) — не пускає нікого', () => {
    expect(
      isBasicAuthorized(basicHeader('', ''), null),
    ).toBe(false);
  });

  it('виклик — 401 з WWW-Authenticate, без кешу й індексації', () => {
    const challenge = basicAuthChallenge();
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
    expect(challenge.headers.get('cache-control')).toBe('no-store');
    expect(challenge.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
