import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RATE_LIMIT_EVENT_RETENTION_MS } from '../security/abuse.constants';
import { ENV_VARIABLE_NAMES, parseEnv } from './env.schema';

/** Лише обов'язкові змінні, як у локальному `.env` */
const REQUIRED_ENV = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:password@localhost:6543/postgres',
  JWT_SECRET: 'jwt-secret-jwt-secret-jwt-secret-jwt',
  EMAIL_HASH_SECRET: 'hmac-secret-hmac-secret-hmac-secret',
  CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
};

/** Текст помилки старту; `''` — середовище валідне */
function startupError(rawEnv: Record<string, string>): string {
  try {
    parseEnv(rawEnv);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('parseEnv — схема змінних середовища (Rule 13)', () => {
  it('лише обов’язкові змінні → решта з дефолтів, CORS_ORIGINS — список', () => {
    expect(parseEnv(REQUIRED_ENV)).toEqual({
      ...REQUIRED_ENV,
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],
      APP_ENV: 'development',
      PORT: 4000,
      FOOTBALL_API_URL: 'https://api.football-data.org/v4',
      FOOTBALL_SYNC_CRON_ENABLED: false,
      FOOTBALL_LIVE_CRON_ENABLED: false,
      FOOTBALL_HTTP_LOG: true,
      COMMENT_COOLDOWN_MS: 60_000,
    });
  });

  it('порожнє значення (`KEY=` з .env.example) — те саме, що змінної немає', () => {
    const env = parseEnv({
      ...REQUIRED_ENV,
      PORT: '',
      TRUST_PROXY: '',
      FOOTBALL_API_KEY: '  ',
    });
    expect(env.PORT).toBe(4000);
    expect(env.TRUST_PROXY).toBeUndefined();
    expect(env.FOOTBALL_API_KEY).toBeUndefined();
    expect(startupError({ ...REQUIRED_ENV, JWT_SECRET: '' })).toContain(
      'JWT_SECRET: is required',
    );
  });

  it('усі проблеми — одним повідомленням, без значень змінних (там секрети)', () => {
    const message = startupError({
      NODE_ENV: 'prod',
      DATABASE_URL: 'mysql://root:hunter2@db.example.com/app',
      JWT_SECRET: 'short-jwt-secret',
      CORS_ORIGINS: 'https://example.com',
    });
    expect(message).toContain('NODE_ENV: must be one of');
    expect(message).toContain('DATABASE_URL: must be a PostgreSQL');
    expect(message).toContain('JWT_SECRET: must be at least 32 characters');
    expect(message).toContain('EMAIL_HASH_SECRET: is required');
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('short-jwt-secret');
  });

  it('production: TRUST_PROXY і APP_ENV обов’язкові, CORS_ORIGINS — лише https', () => {
    const message = startupError({ ...REQUIRED_ENV, NODE_ENV: 'production' });
    expect(message).toContain('TRUST_PROXY: is required in production');
    expect(message).toContain('APP_ENV: is required in production');
    expect(message).toContain('"http://localhost:3000" must use https:');
    expect(message).toContain('"http://localhost:3001" must use https:');
  });

  it('API_ORIGIN_SECRET (D59): поза машиною розробника обов’язковий і свій — не інший секрет', () => {
    const testServerEnv = {
      ...REQUIRED_ENV,
      NODE_ENV: 'production',
      APP_ENV: 'test',
      TRUST_PROXY: 'false',
      CORS_ORIGINS: 'https://site.example',
    };
    expect(startupError(testServerEnv)).toContain(
      'API_ORIGIN_SECRET: is required outside development',
    );
    expect(
      startupError({
        ...testServerEnv,
        API_ORIGIN_SECRET: REQUIRED_ENV.EMAIL_HASH_SECRET,
      }),
    ).toContain('API_ORIGIN_SECRET: must differ from JWT_SECRET');
    const originSecret = 'origin-secret-origin-secret-origin-secret';
    expect(
      parseEnv({ ...testServerEnv, API_ORIGIN_SECRET: originSecret }),
    ).toMatchObject({ APP_ENV: 'test', API_ORIGIN_SECRET: originSecret });
    // Локально — необов'язковий: API відкритий, як до шлюзу
    expect(parseEnv(REQUIRED_ENV).API_ORIGIN_SECRET).toBeUndefined();
  });

  it('API_ORIGIN_SECRET_PREVIOUS (D59, ротація): лише разом з API_ORIGIN_SECRET і не рівний йому', () => {
    const originSecret = 'origin-secret-origin-secret-origin-secret';
    const previousSecret = 'previous-origin-secret-previous-origin-secret';
    expect(
      startupError({
        ...REQUIRED_ENV,
        API_ORIGIN_SECRET_PREVIOUS: previousSecret,
      }),
    ).toContain('API_ORIGIN_SECRET_PREVIOUS: only with API_ORIGIN_SECRET');
    expect(
      startupError({
        ...REQUIRED_ENV,
        API_ORIGIN_SECRET: originSecret,
        API_ORIGIN_SECRET_PREVIOUS: originSecret,
      }),
    ).toContain(
      'API_ORIGIN_SECRET_PREVIOUS: must differ from API_ORIGIN_SECRET',
    );
    expect(
      startupError({
        ...REQUIRED_ENV,
        API_ORIGIN_SECRET: originSecret,
        API_ORIGIN_SECRET_PREVIOUS: 'short-previous-secret',
      }),
    ).toContain('API_ORIGIN_SECRET_PREVIOUS: must be at least 32 characters');
    expect(
      parseEnv({
        ...REQUIRED_ENV,
        API_ORIGIN_SECRET: originSecret,
        API_ORIGIN_SECRET_PREVIOUS: previousSecret,
      }),
    ).toMatchObject({ API_ORIGIN_SECRET_PREVIOUS: previousSecret });
  });

  it('TRUST_PROXY: `true` заборонено (IP підробляється), `false` → 0, число — хопи, решта — адреси', () => {
    expect(startupError({ ...REQUIRED_ENV, TRUST_PROXY: 'true' })).toContain(
      'TRUST_PROXY: true lets clients spoof',
    );
    const trustProxyOf = (value: string) =>
      parseEnv({ ...REQUIRED_ENV, TRUST_PROXY: value }).TRUST_PROXY;
    expect(trustProxyOf('false')).toBe(0);
    expect(trustProxyOf('1')).toBe(1);
    expect(trustProxyOf('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });

  it('CORS_ORIGINS: рівно origin — без шляху, `/` у кінці і `*`', () => {
    expect(
      startupError({ ...REQUIRED_ENV, CORS_ORIGINS: 'http://localhost:3000/' }),
    ).toContain(
      '"http://localhost:3000/" must be exactly an origin (expected "http://localhost:3000")',
    );
    expect(startupError({ ...REQUIRED_ENV, CORS_ORIGINS: '*' })).toContain(
      '"*" is not a valid origin',
    );
    expect(startupError({ ...REQUIRED_ENV, CORS_ORIGINS: ' , ' })).toContain(
      'CORS_ORIGINS: is required',
    );
  });

  it('EMAIL_HASH_SECRET не збігається з JWT_SECRET — один секрет на одне призначення', () => {
    expect(
      startupError({
        ...REQUIRED_ENV,
        EMAIL_HASH_SECRET: REQUIRED_ENV.JWT_SECRET,
      }),
    ).toContain('EMAIL_HASH_SECRET: must differ from JWT_SECRET');
  });

  it('COMMENT_COOLDOWN_MS: 0 вимикає cooldown; довше за зберігання RateLimitEvent — помилка', () => {
    expect(
      parseEnv({ ...REQUIRED_ENV, COMMENT_COOLDOWN_MS: '0' })
        .COMMENT_COOLDOWN_MS,
    ).toBe(0);
    expect(
      startupError({
        ...REQUIRED_ENV,
        COMMENT_COOLDOWN_MS: String(RATE_LIMIT_EVENT_RETENTION_MS + 1),
      }),
    ).toContain('COMMENT_COOLDOWN_MS: must be at most');
    expect(
      startupError({ ...REQUIRED_ENV, COMMENT_COOLDOWN_MS: '1e3' }),
    ).toContain('COMMENT_COOLDOWN_MS: must be a whole number');
  });

  it('прапорці — лише true / false; FOOTBALL_HTTP_LOG: явне значення перемагає дефолт development', () => {
    expect(
      parseEnv({ ...REQUIRED_ENV, FOOTBALL_HTTP_LOG: 'false' })
        .FOOTBALL_HTTP_LOG,
    ).toBe(false);
    expect(
      parseEnv({ ...REQUIRED_ENV, NODE_ENV: 'test' }).FOOTBALL_HTTP_LOG,
    ).toBe(false);
    expect(
      startupError({ ...REQUIRED_ENV, FOOTBALL_LIVE_CRON_ENABLED: 'yes' }),
    ).toContain('FOOTBALL_LIVE_CRON_ENABLED: must be true or false');
  });

  it('FOOTBALL_API_URL — лише https: ключ провайдера йде в заголовку', () => {
    expect(
      startupError({
        ...REQUIRED_ENV,
        FOOTBALL_API_URL: 'http://api.football-data.org/v4',
      }),
    ).toContain('FOOTBALL_API_URL: must be an https URL');
  });

  it('вебхук сайту (D57): обидві змінні або жодна; секрет — свій, ≥ 32 символи; на проді — https або приватний хост', () => {
    const webhookSecret = 'revalidate-secret-revalidate-secret';
    expect(
      parseEnv({
        ...REQUIRED_ENV,
        WEB_REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
        REVALIDATE_SECRET: webhookSecret,
      }),
    ).toMatchObject({
      WEB_REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
      REVALIDATE_SECRET: webhookSecret,
    });
    expect(
      startupError({
        ...REQUIRED_ENV,
        WEB_REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
      }),
    ).toContain('REVALIDATE_SECRET: is required with WEB_REVALIDATE_URL');
    expect(
      startupError({ ...REQUIRED_ENV, REVALIDATE_SECRET: webhookSecret }),
    ).toContain('WEB_REVALIDATE_URL: is required with REVALIDATE_SECRET');
    expect(
      startupError({
        ...REQUIRED_ENV,
        WEB_REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
        REVALIDATE_SECRET: REQUIRED_ENV.JWT_SECRET,
      }),
    ).toContain('REVALIDATE_SECRET: must differ from JWT_SECRET');
    const productionEnv = {
      ...REQUIRED_ENV,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      API_ORIGIN_SECRET: 'origin-secret-origin-secret-origin-secret',
      TRUST_PROXY: '1',
      CORS_ORIGINS: 'https://example.com',
      REVALIDATE_SECRET: webhookSecret,
    };
    expect(
      startupError({
        ...productionEnv,
        WEB_REVALIDATE_URL: 'http://example.com/api/revalidate',
      }),
    ).toContain('WEB_REVALIDATE_URL: must use https in production');
    // Контейнери однієї мережі Docker: http до сервісу `web` — секрет не йде, лише підпис
    for (const privateUrl of [
      'http://web:3000/api/revalidate',
      'http://10.0.0.5:3000/api/revalidate',
    ]) {
      expect(
        startupError({ ...productionEnv, WEB_REVALIDATE_URL: privateUrl }),
      ).toBe('');
    }
  });

  it('.env.example описує кожну змінну схеми', () => {
    const envExample = readFileSync(
      join(__dirname, '../../.env.example'),
      'utf8',
    );
    const documentedNames = new Set(
      [...envExample.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map(
        (match) => match[1],
      ),
    );
    expect(
      ENV_VARIABLE_NAMES.filter((name) => !documentedNames.has(name)),
    ).toEqual([]);
  });
});
