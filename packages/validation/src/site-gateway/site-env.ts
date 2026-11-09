import { z } from 'zod';
import { LOCAL_API_ORIGIN } from '../api-access';
import type { BasicAuthCredentials } from './basic-auth';

/**
 * Серверні змінні шлюзу, спільні для web і адмінки (M1.11.4, D59). Кожен застосунок вкладає `siteGatewayEnvShape` у
 * свою схему й кличе `resolveSiteGatewayEnv` — правила однакові, а перевіряє їх старт сервера застосунку.
 *
 * `APP_ENV` — де працює сервер, окремо від `NODE_ENV` (той — `production` і на тесті, і на проді):
 * - `development` — машина розробника (`next dev`, локальний `next start`): API — localhost, без секрету й пароля;
 * - `test` — тест-сервер: пароль на всьому сайті (Basic Auth), секрет для API;
 * - `production` — прод: секрет для API, без пароля.
 * З `NODE_ENV=production` змінна обов'язкова: забута не має відкрити тест-сервер без пароля.
 */
export const APP_ENVS = ['development', 'test', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVS)[number];

/** Як в API: коротший секрет можна перебрати. */
const ORIGIN_SECRET_MIN_LENGTH = 32;
/** Пароль вводять люди (замовник на демо) — довгий випадковий рядок незручний, коротший — перебирається. */
export const BASIC_AUTH_PASSWORD_MIN_LENGTH = 12;
/** http — лише до API на цій самій машині (налаштування тесту, перевірені локально): секрет іде в заголовку. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

/** `KEY=` без значення — те саме, що змінної немає. */
function emptyAsMissing(value: string | undefined): string | undefined {
  return value || undefined;
}

/** Рівно origin (`https://host[:port]`): без шляху й `/` у кінці — до нього дописують `/api/v1`. */
function isExactOrigin(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.origin === value
  );
}

function isSecureOrLoopback(origin: string): boolean {
  const url = new URL(origin);
  return url.protocol === 'https:' || LOOPBACK_HOSTS.has(url.hostname);
}

const optionalTrimmed = z.string().trim().optional().transform(emptyAsMissing);
/** Секрет і пароль — без `trim`: рядок має збігатися байт у байт. */
const optionalExact = z.string().optional().transform(emptyAsMissing);

export const siteGatewayEnvShape = {
  APP_ENV: optionalTrimmed.pipe(
    z
      .enum(APP_ENVS, { error: `must be one of: ${APP_ENVS.join(' | ')}` })
      .optional(),
  ),
  API_ORIGIN: optionalTrimmed.pipe(
    z
      .string()
      .refine(
        isExactOrigin,
        'must be exactly an http(s) origin without a path, e.g. https://api.example.com',
      )
      .optional(),
  ),
  API_ORIGIN_SECRET: optionalExact.pipe(
    z
      .string()
      .min(
        ORIGIN_SECRET_MIN_LENGTH,
        `must be at least ${ORIGIN_SECRET_MIN_LENGTH} characters — the same API_ORIGIN_SECRET as in the API`,
      )
      .optional(),
  ),
  BASIC_AUTH_USER: optionalTrimmed,
  BASIC_AUTH_PASSWORD: optionalExact.pipe(
    z
      .string()
      .min(
        BASIC_AUTH_PASSWORD_MIN_LENGTH,
        `must be at least ${BASIC_AUTH_PASSWORD_MIN_LENGTH} characters`,
      )
      .optional(),
  ),
};

type SiteGatewayRawEnv = {
  NODE_ENV: string;
} & {
  [Name in keyof typeof siteGatewayEnvShape]?: z.output<
    (typeof siteGatewayEnvShape)[Name]
  >;
};

export interface SiteGatewayEnv {
  appEnv: AppEnvironment;
  /** API для SSR і проксі `/api/*`; `development` без змінної — `http://localhost:4000` */
  apiOrigin: string;
  apiOriginSecret: string | undefined;
  /** Лише `APP_ENV=test` */
  basicAuth: BasicAuthCredentials | null;
}

export interface EnvProblem {
  variable: string;
  message: string;
}

/** Правила між змінними; проблеми — без значень (там секрети), конфіг валідний лише без них. */
export function resolveSiteGatewayEnv(env: SiteGatewayRawEnv): {
  gateway: SiteGatewayEnv;
  problems: EnvProblem[];
} {
  const problems: EnvProblem[] = [];
  const appEnv =
    env.APP_ENV ?? (env.NODE_ENV === 'production' ? null : 'development');
  if (appEnv === null) {
    problems.push({
      variable: 'APP_ENV',
      message: `is required in production: ${APP_ENVS.join(' | ')} (development — next start on a developer machine)`,
    });
  }
  if (appEnv !== 'development') problems.push(...deployedApiProblems(env));
  const basicAuth =
    env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD
      ? { user: env.BASIC_AUTH_USER, password: env.BASIC_AUTH_PASSWORD }
      : null;
  if (appEnv === 'test') problems.push(...basicAuthProblems(env));
  return {
    gateway: {
      appEnv: appEnv ?? 'production',
      apiOrigin: env.API_ORIGIN ?? LOCAL_API_ORIGIN,
      apiOriginSecret: env.API_ORIGIN_SECRET,
      basicAuth: appEnv === 'test' ? basicAuth : null,
    },
    problems,
  };
}

function deployedApiProblems(env: SiteGatewayRawEnv): EnvProblem[] {
  const problems: EnvProblem[] = [];
  if (!env.API_ORIGIN) {
    problems.push({
      variable: 'API_ORIGIN',
      message:
        'is required outside development: API origin, e.g. https://api.example.com',
    });
  } else if (!isSecureOrLoopback(env.API_ORIGIN)) {
    problems.push({
      variable: 'API_ORIGIN',
      message: 'must use https: API_ORIGIN_SECRET travels in a request header',
    });
  }
  if (!env.API_ORIGIN_SECRET) {
    problems.push({
      variable: 'API_ORIGIN_SECRET',
      message:
        'is required outside development: the same API_ORIGIN_SECRET as in the API (openssl rand -base64 48)',
    });
  }
  return problems;
}

function basicAuthProblems(env: SiteGatewayRawEnv): EnvProblem[] {
  const missing = (['BASIC_AUTH_USER', 'BASIC_AUTH_PASSWORD'] as const).filter(
    (variable) => !env[variable],
  );
  return missing.map((variable) => ({
    variable,
    message:
      'is required with APP_ENV=test: the test server is closed with a shared login and password',
  }));
}

export type BasicAuthGate =
  | { isRequired: false }
  /** `credentials: null` — змінні тесту невалідні: не пускаємо нікого (старт сервера з ними однаково не пройде) */
  | { isRequired: true; credentials: BasicAuthCredentials | null };

/**
 * Чи закритий сайт паролем — для `proxy.ts` на кожен запит, без розбору решти змінних. Відкрито лише `development`
 * і `production`; без `APP_ENV` у production і з невідомим значенням — закрито.
 */
export function basicAuthGate(
  source: Readonly<Record<string, string | undefined>>,
): BasicAuthGate {
  const appEnv = siteGatewayEnvShape.APP_ENV.safeParse(source.APP_ENV);
  const isOpen = appEnv.success
    ? appEnv.data === 'production' ||
      appEnv.data === 'development' ||
      (appEnv.data === undefined && source.NODE_ENV !== 'production')
    : false;
  if (isOpen) return { isRequired: false };
  const user = siteGatewayEnvShape.BASIC_AUTH_USER.safeParse(
    source.BASIC_AUTH_USER,
  );
  const password = siteGatewayEnvShape.BASIC_AUTH_PASSWORD.safeParse(
    source.BASIC_AUTH_PASSWORD,
  );
  const credentials =
    user.success && user.data && password.success && password.data
      ? { user: user.data, password: password.data }
      : null;
  return { isRequired: true, credentials };
}
