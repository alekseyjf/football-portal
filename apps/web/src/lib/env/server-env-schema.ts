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

/** `https://example.com` → той самий origin; шлях, query, логін — не адреса сайту. */
function toSiteOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const isOriginOnly =
      (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash && !url.username && !url.password;
    return SITE_URL_PROTOCOLS.has(url.protocol) && isOriginOnly ? url.origin : null;
  } catch {
    return null;
  }
}

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    // `KEY=` без значення — те саме, що змінної немає (як в API)
    SITE_URL: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
  })
  .transform((env, ctx) => {
    if (!env.SITE_URL) {
      if (env.NODE_ENV === 'production') {
        ctx.addIssue({ code: 'custom', path: ['SITE_URL'], message: 'is required in production: site origin, e.g. https://example.com' });
        return z.NEVER;
      }
      return { NODE_ENV: env.NODE_ENV, SITE_URL: DEV_SITE_URL };
    }
    const siteOrigin = toSiteOrigin(env.SITE_URL);
    if (!siteOrigin) {
      ctx.addIssue({ code: 'custom', path: ['SITE_URL'], message: 'must be an http(s) origin without a path, e.g. https://example.com' });
      return z.NEVER;
    }
    return { NODE_ENV: env.NODE_ENV, SITE_URL: siteOrigin };
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

/** `SITE_URL: is required in production…` — назва змінної й що не так, без значення. */
function problemsOf(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
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
