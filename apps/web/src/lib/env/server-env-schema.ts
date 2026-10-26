import { z } from 'zod';

/*
 * Серверні змінні web (як схема env в API, backend Rule 13): перевіряються при старті сервера (`instrumentation.ts`) —
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

/** Змінні → перевірений конфіг; помилка перелічує проблемні змінні, але не їхні значення. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `- ${issue.path.join('.') || 'env'}: ${issue.message}`);
  throw new Error(`Invalid web server environment:\n${problems.join('\n')}`);
}
