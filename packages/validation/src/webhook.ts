/**
 * Вебхук «кеш сайту застарів» (D57): API підписує подію, web перевіряє підпис і оновлює кеш. Формат — контракт між
 * застосунками, тож він тут, в одному місці, з контрольним вектором у тестах.
 *
 * Лише для сервера: `node:crypto`. `server-only` тут не імпортуємо — на ньому впаде NestJS; у web цей модуль бере
 * обгортка з `import 'server-only'` (`apps/web/src/lib/revalidate/`).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { POST_NUMBER_MAX } from './index';

export const REVALIDATE_TIMESTAMP_HEADER = 'X-Revalidate-Timestamp';
export const REVALIDATE_SIGNATURE_HEADER = 'X-Revalidate-Signature';

/**
 * Вікно часу підпису — ±5 хв: перехоплений запит не повторити пізніше, а розбіжність годинників API й web (і запит,
 * що йшов кілька секунд) — не відмова.
 */
export const REVALIDATE_TIMESTAMP_TOLERANCE_SECONDS = 300;

const SIGNATURE_PREFIX = 'sha256=';
/** Секунди Unix — лише цифри: `1e9`, `-1`, `0x…` не приймаємо. */
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

export interface RevalidateSignatureInput {
  secret: string;
  /** Секунди Unix — момент відправлення */
  timestamp: number;
  /** Тіло запиту — рівно ті байти, що йдуть у мережу */
  body: string;
}

/** `sha256=<hex HMAC-SHA256(секрет, "{timestamp}.{тіло}")>` — значення заголовка `X-Revalidate-Signature`. */
export function signRevalidatePayload(input: RevalidateSignatureInput): string {
  const digest = createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest('hex');
  return `${SIGNATURE_PREFIX}${digest}`;
}

export interface RevalidateVerificationInput {
  /** Чинний секрет першим; під час ротації — ще й попередній */
  secrets: readonly string[];
  /** Заголовки як прийшли; `null` — заголовка немає */
  timestamp: string | null;
  signature: string | null;
  /** Сире тіло — підпис рахують від нього, ще до `JSON.parse` */
  body: string;
  nowSeconds: number;
}

/** Причина — для лога сайту (без тіла й підпису). */
export type RevalidateVerification =
  | { valid: true }
  | {
      valid: false;
      reason: 'missing-signature' | 'stale-timestamp' | 'bad-signature';
    };

/**
 * Підпис запиту дійсний: час — у вікні ±5 хв, HMAC збігається з одним із секретів. Порівняння — за сталий час
 * (`timingSafeEqual`), а довжину перевіряємо перед ним: `timingSafeEqual` на різних довжинах кидає виняток.
 */
export function verifyRevalidatePayload(
  input: RevalidateVerificationInput,
): RevalidateVerification {
  if (!input.timestamp || !input.signature) {
    return { valid: false, reason: 'missing-signature' };
  }
  if (!isFreshTimestamp(input.timestamp, input.nowSeconds)) {
    return { valid: false, reason: 'stale-timestamp' };
  }
  const received = Buffer.from(input.signature);
  const timestamp = Number(input.timestamp);
  const matches = input.secrets.some((secret) => {
    const expected = Buffer.from(
      signRevalidatePayload({ secret, timestamp, body: input.body }),
    );
    return (
      expected.length === received.length &&
      timingSafeEqual(expected, received)
    );
  });
  return matches ? { valid: true } : { valid: false, reason: 'bad-signature' };
}

function isFreshTimestamp(timestamp: string, nowSeconds: number): boolean {
  if (!TIMESTAMP_PATTERN.test(timestamp)) return false;
  return (
    Math.abs(nowSeconds - Number(timestamp)) <=
    REVALIDATE_TIMESTAMP_TOLERANCE_SECONDS
  );
}

/** Новина з'явилась, змінилась (текст, адреса, теги…) чи зникла з сайту. */
export const POST_CONTENT_EVENTS = [
  'post.published',
  'post.updated',
  'post.unpublished',
] as const;
/** Змінилась головна новина сайту (D56): закріпили чи зняли закріплення. */
export const HOME_UPDATED_EVENT = 'home.updated';

/**
 * Тіло вебхука. Зайві поля відкидаються, а не дають 400: API може додати поле (`previousSlug`, backlog) раніше, ніж
 * його почне читати сайт.
 */
export const contentEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.enum(POST_CONTENT_EVENTS),
    post: z.object({
      id: z.string().min(1),
      number: z.number().int().min(1).max(POST_NUMBER_MAX),
      slug: z.string().min(1),
    }),
  }),
  z.object({ event: z.literal(HOME_UPDATED_EVENT) }),
]);

export type ContentEvent = z.infer<typeof contentEventSchema>;
export type PostContentEvent = Extract<ContentEvent, { post: unknown }>;
