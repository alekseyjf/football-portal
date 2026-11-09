import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  basicAuthGate,
  resolveSiteGatewayEnv,
  siteGatewayEnvShape,
} from './site-env';

const SECRET = 'origin-secret-origin-secret-origin-secret';
const TEST_SERVER_ENV = {
  NODE_ENV: 'production',
  APP_ENV: 'test',
  API_ORIGIN: 'https://api.example.onrender.com',
  API_ORIGIN_SECRET: SECRET,
  BASIC_AUTH_USER: 'tester',
  BASIC_AUTH_PASSWORD: 'long-enough-password',
};

const schema = z.object({ NODE_ENV: z.string(), ...siteGatewayEnvShape });

function resolve(raw: Record<string, string>) {
  return resolveSiteGatewayEnv(schema.parse(raw));
}

function problemVariables(raw: Record<string, string>): string[] {
  return resolve(raw).problems.map((problem) => problem.variable);
}

describe('змінні шлюзу web і адмінки (D59)', () => {
  it('машина розробника без змінних — development: API на localhost, без секрету й пароля', () => {
    expect(resolve({ NODE_ENV: 'development' })).toEqual({
      gateway: {
        appEnv: 'development',
        apiOrigin: 'http://localhost:4000',
        apiOriginSecret: undefined,
        basicAuth: null,
      },
      problems: [],
    });
  });

  it('NODE_ENV=production без APP_ENV — помилка старту, а не відкритий сайт', () => {
    expect(problemVariables({ NODE_ENV: 'production' })).toEqual([
      'APP_ENV',
      'API_ORIGIN',
      'API_ORIGIN_SECRET',
    ]);
  });

  it('тест-сервер: усе задано → пароль увімкнено; без пароля чи логіна — помилка', () => {
    const { gateway, problems } = resolve(TEST_SERVER_ENV);
    expect(problems).toEqual([]);
    expect(gateway).toEqual({
      appEnv: 'test',
      apiOrigin: TEST_SERVER_ENV.API_ORIGIN,
      apiOriginSecret: SECRET,
      basicAuth: { user: 'tester', password: 'long-enough-password' },
    });
    expect(
      problemVariables({
        ...TEST_SERVER_ENV,
        BASIC_AUTH_USER: '',
        BASIC_AUTH_PASSWORD: '',
      }),
    ).toEqual(['BASIC_AUTH_USER', 'BASIC_AUTH_PASSWORD']);
  });

  it('поза development API — лише https (секрет у заголовку); http — до localhost', () => {
    expect(
      problemVariables({
        ...TEST_SERVER_ENV,
        API_ORIGIN: 'http://api.example.onrender.com',
      }),
    ).toEqual(['API_ORIGIN']);
    expect(
      problemVariables({ ...TEST_SERVER_ENV, API_ORIGIN: 'http://localhost:4000' }),
    ).toEqual([]);
  });

  it('межі значень — помилка схеми: не origin, короткий секрет і пароль, невідоме середовище', () => {
    for (const [variable, value] of [
      ['API_ORIGIN', 'https://api.example.com/'],
      ['API_ORIGIN', 'https://api.example.com/api/v1'],
      ['API_ORIGIN_SECRET', 'too-short'],
      ['BASIC_AUTH_PASSWORD', 'short'],
      ['APP_ENV', 'staging'],
    ]) {
      const result = schema.safeParse({ ...TEST_SERVER_ENV, [variable]: value });
      expect(result.success).toBe(false);
    }
  });
});

describe('basicAuthGate — пароль на кожен запит (proxy.ts)', () => {
  it('development і production — без пароля; test — з обліковими даними', () => {
    expect(basicAuthGate({ NODE_ENV: 'development' })).toEqual({
      isRequired: false,
    });
    expect(
      basicAuthGate({ ...TEST_SERVER_ENV, APP_ENV: 'production' }),
    ).toEqual({ isRequired: false });
    expect(basicAuthGate(TEST_SERVER_ENV)).toEqual({
      isRequired: true,
      credentials: { user: 'tester', password: 'long-enough-password' },
    });
  });

  it('забуте чи невідоме APP_ENV у production або невалідний пароль — закрито для всіх', () => {
    for (const source of [
      { NODE_ENV: 'production' },
      { NODE_ENV: 'production', APP_ENV: 'staging' },
      { ...TEST_SERVER_ENV, BASIC_AUTH_PASSWORD: 'short' },
    ]) {
      expect(basicAuthGate(source)).toEqual({
        isRequired: true,
        credentials: null,
      });
    }
  });
});
