import { describe, expect, it } from 'vitest';
import { parseServerEnv, validateServerEnv } from './server-env-schema';

describe('Перевірка при старті сервера (validateServerEnv)', () => {
  it('SITE_URL є — проблем немає', () => {
    expect(
      validateServerEnv({
        NODE_ENV: 'production',
        SITE_URL: 'https://portal.test',
      }),
    ).toEqual([]);
  });

  it('у production SITE_URL немає — одна проблема з назвою змінної', () => {
    expect(validateServerEnv({ NODE_ENV: 'production' })).toEqual([
      'SITE_URL: is required in production: site origin, e.g. https://example.com',
    ]);
  });

  it('невалідна адреса — проблема з назвою змінної, без значення', () => {
    const problems = validateServerEnv({
      NODE_ENV: 'production',
      SITE_URL: 'https://portal.test/secret-path',
    });
    expect(problems).toEqual([
      'SITE_URL: must be an http(s) origin without a path, e.g. https://example.com',
    ]);
    expect(problems.join()).not.toContain('secret-path');
  });
});

describe('Серверні змінні web', () => {
  it('production без SITE_URL (і з порожнім) — помилка називає змінну', () => {
    for (const SITE_URL of [undefined, '', '   ']) {
      expect(() =>
        parseServerEnv({ NODE_ENV: 'production', SITE_URL }),
      ).toThrow(/SITE_URL: is required in production/);
    }
  });

  it('поза production без SITE_URL — локальна адреса', () => {
    expect(parseServerEnv({ NODE_ENV: 'development' }).SITE_URL).toBe(
      'http://localhost:3000',
    );
    expect(parseServerEnv({}).SITE_URL).toBe('http://localhost:3000');
  });

  it('адреса — origin без `/` у кінці; порт лишається', () => {
    expect(
      parseServerEnv({
        NODE_ENV: 'production',
        SITE_URL: ' https://Example.com/ ',
      }).SITE_URL,
    ).toBe('https://example.com');
    expect(
      parseServerEnv({
        NODE_ENV: 'production',
        SITE_URL: 'http://localhost:3000',
      }).SITE_URL,
    ).toBe('http://localhost:3000');
  });

  it.each([
    'portal.test',
    'ftp://portal.test',
    'https://portal.test/uk',
    'https://portal.test?x=1',
    'https://user:pass@portal.test',
  ])('не origin http(s) (%j) — помилка, без значення в тексті', (SITE_URL) => {
    expect(() => parseServerEnv({ NODE_ENV: 'production', SITE_URL })).toThrow(
      /SITE_URL: must be an http\(s\) origin/,
    );
    try {
      parseServerEnv({ NODE_ENV: 'production', SITE_URL });
    } catch (error) {
      expect((error as Error).message).not.toContain(SITE_URL);
    }
  });
});
