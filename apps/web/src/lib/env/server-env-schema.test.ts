import { describe, expect, it } from 'vitest';
import {
  isSiteIndexingEnabled,
  parseServerEnv,
  validateServerEnv,
} from './server-env-schema';

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

describe('Індексація сайту (SITE_INDEXING, M1.8.3)', () => {
  it('за замовчуванням — закрито: змінної немає чи вона порожня', () => {
    for (const SITE_INDEXING of [undefined, '', '  ']) {
      expect(
        parseServerEnv({ NODE_ENV: 'development', SITE_INDEXING })
          .SITE_INDEXING,
      ).toBe(false);
      expect(isSiteIndexingEnabled({ SITE_INDEXING })).toBe(false);
    }
  });

  it('відкриває лише `true`; `false` — закрито', () => {
    expect(parseServerEnv({ SITE_INDEXING: 'true' }).SITE_INDEXING).toBe(true);
    expect(parseServerEnv({ SITE_INDEXING: 'false' }).SITE_INDEXING).toBe(
      false,
    );
    expect(isSiteIndexingEnabled({ SITE_INDEXING: 'true' })).toBe(true);
    expect(isSiteIndexingEnabled({ SITE_INDEXING: 'false' })).toBe(false);
  });

  it.each(['yes', '1', 'TRUE', 'on'])(
    'не `true` / `false` (%j) — сервер не стартує, а proxy вважає сайт закритим',
    (SITE_INDEXING) => {
      expect(validateServerEnv({ SITE_INDEXING })).toEqual([
        'SITE_INDEXING: must be true or false (without it the site is not indexed)',
      ]);
      expect(isSiteIndexingEnabled({ SITE_INDEXING })).toBe(false);
    },
  );
});

describe('Секрет вебхука API (REVALIDATE_SECRET, D57)', () => {
  const SECRET = 'revalidate-secret-revalidate-secret';
  const PREVIOUS = 'previous-secret-previous-secret-previous';

  it('опційний: без нього — без вебхука; з ним — як є, без trim', () => {
    expect(parseServerEnv({}).REVALIDATE_SECRET).toBeUndefined();
    expect(parseServerEnv({ REVALIDATE_SECRET: '' }).REVALIDATE_SECRET).toBe(
      undefined,
    );
    const env = parseServerEnv({
      REVALIDATE_SECRET: SECRET,
      REVALIDATE_SECRET_PREVIOUS: PREVIOUS,
    });
    expect([env.REVALIDATE_SECRET, env.REVALIDATE_SECRET_PREVIOUS]).toEqual([
      SECRET,
      PREVIOUS,
    ]);
  });

  it('коротший за 32 символи — проблема без значення', () => {
    const problems = validateServerEnv({ REVALIDATE_SECRET: 'short-secret' });
    expect(problems).toEqual([
      'REVALIDATE_SECRET: must be at least 32 characters — the same REVALIDATE_SECRET as in apps/api/.env',
    ]);
    expect(problems.join()).not.toContain('short-secret');
  });

  it('попередній без чинного — проблема: його приймаємо лише під час ротації', () => {
    expect(validateServerEnv({ REVALIDATE_SECRET_PREVIOUS: PREVIOUS })).toEqual(
      [
        'REVALIDATE_SECRET_PREVIOUS: requires REVALIDATE_SECRET: the previous secret is accepted only next to the current one, during rotation',
      ],
    );
  });

  it('кілька невалідних змінних — усі проблеми разом', () => {
    expect(
      validateServerEnv({
        NODE_ENV: 'production',
        SITE_URL: 'https://portal.test/uk',
        SITE_INDEXING: 'yes',
        REVALIDATE_SECRET: 'short',
      }),
    ).toHaveLength(3);
  });
});
