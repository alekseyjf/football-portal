import 'server-only';
import {
  REVALIDATE_SIGNATURE_HEADER,
  REVALIDATE_TIMESTAMP_HEADER,
  type RevalidateVerification,
  verifyRevalidatePayload,
} from '@football-portal/validation/webhook';
import { serverEnv } from '@/lib/env/server-env';

/*
 * Перевірка підпису вебхука API на сервері web (D57). Сам формат — у `@football-portal/validation/webhook` (спільний з
 * API, з контрольним вектором); пакет `server-only` не імпортує, бо його бере й NestJS, — тож обгортка тут.
 */

/** Секрети вебхука: чинний першим, під час ротації — ще й попередній. Порожньо — вебхук вимкнено. */
export function revalidateSecrets(): string[] {
  const env = serverEnv();
  return [env.REVALIDATE_SECRET, env.REVALIDATE_SECRET_PREVIOUS].filter(
    (secret): secret is string => secret !== undefined,
  );
}

export function verifyRevalidateRequest(
  request: Request,
  signed: { body: string; secrets: readonly string[]; nowSeconds: number },
): RevalidateVerification {
  return verifyRevalidatePayload({
    secrets: signed.secrets,
    timestamp: request.headers.get(REVALIDATE_TIMESTAMP_HEADER),
    signature: request.headers.get(REVALIDATE_SIGNATURE_HEADER),
    body: signed.body,
    nowSeconds: signed.nowSeconds,
  });
}
