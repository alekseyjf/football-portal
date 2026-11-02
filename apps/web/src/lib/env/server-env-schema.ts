import { z } from 'zod';

/*
 * Серверні змінні web (як схема env в API, backend Rule 13): перевіряються при старті сервера (`instrumentation-node.ts`) —
 * з відсутньою чи невалідною змінною `next start` не стартує й перелічує всі проблеми, без значень. Читаються під час
 * запиту, а не вбудовуються при збірці, як `NEXT_PUBLIC_*`: одна збірка — для будь-якої адреси. Перелік — `.env.example`.
 */

const NODE_ENVS = ['development', 'production', 'test'] as const;
/** Без змінної поза production — локальна розробка (`next dev`). */
const DEV_SITE_URL = 'http://localhost:3000';
const SITE_URL_PROTOCOLS = new Set(['http:', 'https:']);
/** Як в API: коротший секрет HMAC можна перебрати офлайн, маючи один підписаний запит. */
const SECRET_MIN_LENGTH = 32;

/** `KEY=` без значення — те саме, що змінної немає (як в API). */
function emptyAsMissing(value: string | undefined): string | undefined {
  return value || undefined;
}

/** `https://example.com` → той самий origin; шлях, query, логін — не адреса сайту. */
function toSiteOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const isOriginOnly =
      (url.pathname === '/' || url.pathname === '') &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
    return SITE_URL_PROTOCOLS.has(url.protocol) && isOriginOnly
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const siteUrl = z
  .string()
  .trim()
  .optional()
  .transform(emptyAsMissing)
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    const siteOrigin = toSiteOrigin(value);
    if (siteOrigin) return siteOrigin;
    ctx.addIssue({
      code: 'custom',
      message:
        'must be an http(s) origin without a path, e.g. https://example.com',
    });
    return z.NEVER;
  });

/**
 * Індексація сайту пошуковиками (M1.8.3): лише `true` відкриває. Немає змінної — закрито: `NODE_ENV=production` і на
 * тесті, і на проді, а забута змінна має закривати сайт, а не відкривати тест-сервер.
 */
const siteIndexing = z
  .string()
  .trim()
  .optional()
  .transform(emptyAsMissing)
  .pipe(
    z
      .enum(['true', 'false'], {
        error: 'must be true or false (without it the site is not indexed)',
      })
      .optional(),
  )
  .transform((value) => value === 'true');

/** Секрет вебхука API — без `trim`: рядок має збігатися з `REVALIDATE_SECRET` API байт у байт. */
const revalidateSecret = z
  .string()
  .optional()
  .transform(emptyAsMissing)
  .pipe(
    z
      .string()
      .min(
        SECRET_MIN_LENGTH,
        `must be at least ${SECRET_MIN_LENGTH} characters — the same REVALIDATE_SECRET as in apps/api/.env`,
      )
      .optional(),
  );

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    SITE_URL: siteUrl,
    SITE_INDEXING: siteIndexing,
    // Вебхук API (D57): без секрету `POST /api/revalidate` — 404, кеш оновлює лише TTL
    REVALIDATE_SECRET: revalidateSecret,
    // Ротація: попередній секрет приймаємо, поки API ще підписує ним
    REVALIDATE_SECRET_PREVIOUS: revalidateSecret,
  })
  .transform((env, ctx) => {
    let hasProblems = false;
    if (!env.SITE_URL && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SITE_URL'],
        message:
          'is required in production: site origin, e.g. https://example.com',
      });
      hasProblems = true;
    }
    if (env.REVALIDATE_SECRET_PREVIOUS && !env.REVALIDATE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['REVALIDATE_SECRET_PREVIOUS'],
        message:
          'requires REVALIDATE_SECRET: the previous secret is accepted only next to the current one, during rotation',
      });
      hasProblems = true;
    }
    if (hasProblems) return z.NEVER;
    return { ...env, SITE_URL: env.SITE_URL ?? DEV_SITE_URL };
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

/** `SITE_URL: is required in production…` — назва змінної й що не так, без значення. */
function problemsOf(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`,
  );
}

/**
 * Проблеми серверних змінних; порожній список — усе гаразд. Чиста функція: що робити з проблемами, вирішує старт
 * сервера (`instrumentation-node.ts`).
 */
export function validateServerEnv(source: EnvSource): string[] {
  const result = serverEnvSchema.safeParse(source);
  return result.success ? [] : problemsOf(result.error);
}

/** Повідомлення про невалідний конфіг: усі проблеми, кожна з нового рядка. */
export function formatServerEnvProblems(problems: readonly string[]): string {
  return `Invalid web server environment:\n${problems.map((problem) => `- ${problem}`).join('\n')}`;
}

/** Змінні → перевірений конфіг; помилка перелічує проблемні змінні, але не їхні значення. */
export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  throw new Error(formatServerEnvProblems(problemsOf(result.error)));
}

/**
 * Лише `SITE_INDEXING` — для `proxy.ts` на кожен запит, без розбору решти змінних. Невалідне значення — закрито
 * (старт сервера з ним і так не пройде).
 */
export function isSiteIndexingEnabled(source: EnvSource): boolean {
  const result = siteIndexing.safeParse(source.SITE_INDEXING);
  return result.success && result.data;
}
