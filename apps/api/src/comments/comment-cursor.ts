/**
 * Курсор порції коментарів (D27): непрозорий для клієнта рядок — base64url JSON позиції останнього виданого
 * коментаря в порядку порції (keyset). Порядок і список (новина, матч чи гілка) — у курсорі: курсор з іншого
 * списку чи порядку — невалідний, а не «тихо не та сторінка». `v` — версія формату: «Популярні» зі знімком
 * порядку (M2.14) — `v: 2`, курсори «Нових» лишаються тими самими.
 */

/** Порядок порції: корені — нові першими; відповіді гілки — від старих до нових. */
export type CommentPageOrder = 'newest' | 'oldest';

/** Позиція в порядку порції: останній виданий коментар. */
export type CommentPagePosition = { createdAt: Date; id: string };

/** Список, якому належить курсор: корені новини / матчу або відповіді гілки. */
export type CommentListScope =
  | `post:${string}`
  | `match:${string}`
  | `replies:${string}`;

export type CommentCursorContext = {
  order: CommentPageOrder;
  scope: CommentListScope;
};

const COMMENT_CURSOR_VERSION = 1;

/** Сміття в запиті відсікає DTO (`COMMENT_CURSOR_MAX_LENGTH`); тут — лише формат base64url. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** cuid — 25 символів; більше — не наш id. */
const COMMENT_ID_MAX_LENGTH = 64;

type CommentCursorPayload = {
  v: typeof COMMENT_CURSOR_VERSION;
  sort: CommentPageOrder;
  scope: CommentListScope;
  /** ISO з мілісекундами — точність `createdAt` (`timestamptz(3)`) */
  createdAt: string;
  id: string;
};

export function encodeCommentCursor(
  context: CommentCursorContext,
  position: CommentPagePosition,
): string {
  const payload: CommentCursorPayload = {
    v: COMMENT_CURSOR_VERSION,
    sort: context.order,
    scope: context.scope,
    createdAt: position.createdAt.toISOString(),
    id: position.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** `null` — курсор не наш: не той формат, інший порядок чи список, зіпсована дата. */
export function decodeCommentCursor(
  rawCursor: string,
  expected: CommentCursorContext,
): CommentPagePosition | null {
  if (!BASE64URL_PATTERN.test(rawCursor)) return null;
  const payload = parseJsonObject(
    Buffer.from(rawCursor, 'base64url').toString('utf8'),
  );
  if (
    !payload ||
    payload.v !== COMMENT_CURSOR_VERSION ||
    payload.sort !== expected.order ||
    payload.scope !== expected.scope ||
    typeof payload.createdAt !== 'string' ||
    typeof payload.id !== 'string' ||
    payload.id.length === 0 ||
    payload.id.length > COMMENT_ID_MAX_LENGTH
  ) {
    return null;
  }
  const createdAt = new Date(payload.createdAt);
  // Лише рядок, який видав сам API: інакше `Date` «вгадає» дату з будь-чого
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== payload.createdAt
  ) {
    return null;
  }
  return { createdAt, id: payload.id };
}

function parseJsonObject(json: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // Не JSON — не наш курсор; відповідь — 400 у сервісі
    return null;
  }
}
