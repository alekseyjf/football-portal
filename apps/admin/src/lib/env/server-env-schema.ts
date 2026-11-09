import {
  resolveSiteGatewayEnv,
  siteGatewayEnvShape,
  type SiteGatewayEnv,
} from '@football-portal/validation/site-gateway';
import { z } from 'zod';

/*
 * Серверні змінні адмінки (M1.11.4, D59) — шлюз до API і пароль тест-сервера, ті самі правила, що в web
 * (`@football-portal/validation/site-gateway`). Перевіряються при старті сервера (`instrumentation-node.ts`): з невалідними
 * `next start` не стартує й перелічує проблеми без значень. Перелік — `.env.example`.
 */

const NODE_ENVS = ['development', 'production', 'test'] as const;

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default('development'),
    ...siteGatewayEnvShape,
  })
  .transform((env, ctx) => {
    const { gateway, problems } = resolveSiteGatewayEnv(env);
    for (const problem of problems) {
      ctx.addIssue({
        code: 'custom',
        path: [problem.variable],
        message: problem.message,
      });
    }
    return problems.length > 0 ? z.NEVER : gateway;
  });

type EnvSource = Record<string, string | undefined>;

function problemsOf(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`,
  );
}

/** Проблеми серверних змінних; порожній список — усе гаразд. */
export function validateServerEnv(source: EnvSource): string[] {
  const result = serverEnvSchema.safeParse(source);
  return result.success ? [] : problemsOf(result.error);
}

export function formatServerEnvProblems(problems: readonly string[]): string {
  return `Invalid admin server environment:\n${problems.map((problem) => `- ${problem}`).join('\n')}`;
}

/** Змінні → перевірений шлюз; помилка перелічує проблемні змінні, але не їхні значення. */
export function parseServerEnv(source: EnvSource): SiteGatewayEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;
  throw new Error(formatServerEnvProblems(problemsOf(result.error)));
}
