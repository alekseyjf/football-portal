import { z } from 'zod';
import { RATE_LIMIT_EVENT_RETENTION_MS } from '../security/abuse.constants';

/*
 * Єдина схема змінних середовища API (Rule 13). Перевіряється один раз при старті (`env.config.ts`):
 * з відсутньою або невалідною змінною API не стартує й перелічує всі проблеми разом.
 * Перелік із поясненнями — `apps/api/.env.example`. `DIRECT_URL` і `SEED_ADMIN_*` читає лише CLI
 * (`prisma.config.ts`, `prisma/seed.ts`), тож у схемі їх немає.
 */

const NODE_ENVS = ['development', 'production', 'test'] as const;

/** Коротший секрет HS256 / HMAC можна перебрати офлайн — маючи будь-який виданий токен або витік таблиці. */
const SECRET_MIN_LENGTH = 32;
const DEFAULT_PORT = 4000;
const MAX_PORT = 65_535;
const DEFAULT_FOOTBALL_API_URL = 'https://api.football-data.org/v4';
const DEFAULT_COMMENT_COOLDOWN_MS = 60_000;
const CORS_ORIGINS_REQUIRED =
  'is required: comma-separated web/admin origins, e.g. https://example.com';

/** Повідомлення, коли змінної немає; решту помилок типу описує zod. */
function whenMissing(message: string) {
  return (issue: { input?: unknown }) =>
    issue.input === undefined ? message : undefined;
}

const wholeNumber = z
  .string()
  .trim()
  .regex(/^\d+$/, 'must be a whole number')
  .transform(Number);

const booleanFlag = z
  .enum(['true', 'false'], { error: 'must be true or false' })
  .transform((value) => value === 'true');

const secret = z
  .string({
    error: whenMissing(
      'is required: random, at least 32 characters (openssl rand -base64 48)',
    ),
  })
  .min(
    SECRET_MIN_LENGTH,
    `must be at least ${SECRET_MIN_LENGTH} characters (openssl rand -base64 48)`,
  );

/**
 * `TRUST_PROXY` — скільки reverse proxy стоїть перед API (напр. `1`) або їхні адреси / підмережі
 * (`loopback`, `10.0.0.0/8`); `0` / `false` — проксі немає. Express тоді бере `req.ip`
 * з `X-Forwarded-For`, відкинувши рівно стільки довірених хопів.
 * Без нього за проксі `req.ip` = адреса проксі: ліміти на IP спільні для всіх,
 * а `AuthSession.ipAddress` марний — тому на проді значення обов'язкове (свідоме рішення).
 * У dev порожньо: без проксі довіра до `X-Forwarded-For` дозволила б підробляти IP.
 * `true` заборонено: тоді `req.ip` — крайній лівий `X-Forwarded-For`, який підробляє клієнт.
 */
const trustProxy = z
  .string({
    error: whenMissing(
      'is required in production: proxy hop count (e.g. 1) or 0 if there is no proxy',
    ),
  })
  .trim()
  .refine(
    (value) => value !== 'true',
    'true lets clients spoof their IP via X-Forwarded-For; set a hop count (e.g. 1) or proxy addresses',
  )
  .transform((value): number | string => {
    if (value === 'false') return 0;
    return /^\d+$/.test(value) ? Number(value) : value;
  });

/**
 * `CORS_ORIGINS` — через кому, напр. `http://localhost:3000,http://localhost:3001`.
 * Кожне значення — рівно origin (`scheme://host[:port]`): без шляху, `/` у кінці і `*`
 * (з `credentials: true` wildcard неприпустимий). На проді — лише https.
 */
function corsOrigins(isProduction: boolean) {
  const allowedProtocols = isProduction ? ['https:'] : ['http:', 'https:'];
  return z
    .string({ error: whenMissing(CORS_ORIGINS_REQUIRED) })
    .transform((value, ctx) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
      if (origins.length === 0) {
        ctx.addIssue({ code: 'custom', message: CORS_ORIGINS_REQUIRED });
      }
      for (const origin of origins) {
        const problem = describeOriginProblem(origin, allowedProtocols);
        if (problem) ctx.addIssue({ code: 'custom', message: problem });
      }
      return origins;
    });
}

function describeOriginProblem(
  origin: string,
  allowedProtocols: readonly string[],
): string | null {
  const parsedOrigin = URL.parse(origin);
  if (!parsedOrigin) return `"${origin}" is not a valid origin`;
  if (parsedOrigin.origin !== origin) {
    return `"${origin}" must be exactly an origin (expected "${parsedOrigin.origin}")`;
  }
  if (!allowedProtocols.includes(parsedOrigin.protocol)) {
    return `"${origin}" must use ${allowedProtocols.join(' or ')}`;
  }
  return null;
}

/** Правила, що залежать від інших змінних (`NODE_ENV`, `JWT_SECRET`), беруть їх із сирого середовища. */
function buildEnvSchema(definedEnv: Readonly<Record<string, unknown>>) {
  const nodeEnvs = NODE_ENVS.join(' | ');
  return z.object({
    NODE_ENV: z.enum(NODE_ENVS, {
      error: (issue) =>
        issue.input === undefined
          ? `is required: ${nodeEnvs}`
          : `must be one of: ${nodeEnvs}`,
    }),
    PORT: wholeNumber
      .pipe(
        z
          .number()
          .min(1, `must be a port number 1–${MAX_PORT}`)
          .max(MAX_PORT, `must be a port number 1–${MAX_PORT}`),
      )
      .default(DEFAULT_PORT),
    DATABASE_URL: z
      .string({
        error: whenMissing(
          'is required: PostgreSQL connection string (Supabase transaction pooler, port 6543)',
        ),
      })
      .regex(
        /^postgres(ql)?:\/\//,
        'must be a PostgreSQL connection string: postgresql://…',
      ),
    JWT_SECRET: secret,
    EMAIL_HASH_SECRET: secret.refine(
      (value) => value !== definedEnv.JWT_SECRET,
      'must differ from JWT_SECRET: one secret per purpose',
    ),
    CORS_ORIGINS: corsOrigins(definedEnv.NODE_ENV === 'production'),
    TRUST_PROXY:
      definedEnv.NODE_ENV === 'production' ? trustProxy : trustProxy.optional(),
    FOOTBALL_API_KEY: z.string().trim().optional(),
    FOOTBALL_API_URL: z
      .url({
        protocol: /^https$/,
        error: 'must be an https URL: the API key goes in a request header',
      })
      .default(DEFAULT_FOOTBALL_API_URL),
    FOOTBALL_LIVE_CRON_ENABLED: booleanFlag.default(false),
    // У development за замовчуванням увімкнено; явне значення перемагає
    FOOTBALL_HTTP_LOG: booleanFlag.default(
      definedEnv.NODE_ENV === 'development',
    ),
    // Події старші за retention cron видаляє — довший cooldown перестав би діяти
    COMMENT_COOLDOWN_MS: wholeNumber
      .pipe(
        z
          .number()
          .max(
            RATE_LIMIT_EVENT_RETENTION_MS,
            `must be at most ${RATE_LIMIT_EVENT_RETENTION_MS} (RateLimitEvent retention)`,
          ),
      )
      .default(DEFAULT_COMMENT_COOLDOWN_MS),
  });
}

export type AppEnv = z.infer<ReturnType<typeof buildEnvSchema>>;

/** Усі змінні схеми — `.env.example` має описувати кожну (тест). */
export const ENV_VARIABLE_NAMES: readonly string[] = Object.keys(
  buildEnvSchema({}).shape,
);

/**
 * Перевіряє сирі змінні (`process.env`): усі проблеми — одним повідомленням і без значень (там секрети).
 * `KEY=` без значення (так у `.env.example`) — те саме, що змінної немає.
 */
export function parseEnv(rawEnv: Readonly<Record<string, unknown>>): AppEnv {
  const definedEnv = Object.fromEntries(
    Object.entries(rawEnv).filter(
      ([, value]) => !(typeof value === 'string' && value.trim() === ''),
    ),
  );
  const result = buildEnvSchema(definedEnv).safeParse(definedEnv);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment variables (see apps/api/.env.example):\n${problems.join('\n')}`,
    );
  }
  return result.data;
}
