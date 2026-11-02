import { contentEventSchema } from '@football-portal/validation/webhook';
import { cacheTagsForEvent } from './content-event-tags';
import { verifyRevalidateRequest } from './verify';

/** Тіло події — ~150 байт: більше — не наш запит, і в пам'ять до перевірки підпису його не читаємо. */
export const REVALIDATE_BODY_MAX_BYTES = 16 * 1024;

/** `revalidateTag` з `next/cache` — параметром, щоб правило перевіряв unit-тест без сервера Next. */
export type RevalidateTag = (
  tag: string,
  profile: 'max' | { expire: number },
) => void;

export type RevalidateRequestContext = {
  /** `revalidateSecrets()`; порожньо — вебхук вимкнено */
  secrets: readonly string[];
  nowSeconds: number;
  revalidateTag: RevalidateTag;
};

/**
 * Вебхук API `POST /api/revalidate` (D57) — єдиний вхід ззовні, що змінює стан сайту. Порядок: без секрету — 404
 * (маршруту наче немає) → сире тіло (не більше межі, інакше 413) → підпис від сирого тіла, час ±5 хв (401) → лише
 * тоді `JSON.parse` і схема події (400) → теги. Тіло й підпис у лог не йдуть — лише причина відмови.
 */
export async function handleRevalidateRequest(
  request: Request,
  context: RevalidateRequestContext,
): Promise<Response> {
  if (context.secrets.length === 0) return emptyResponse(404);
  const body = await readBodyWithLimit(request, REVALIDATE_BODY_MAX_BYTES);
  if (body === null) return emptyResponse(413);

  const verification = verifyRevalidateRequest(request, {
    body,
    secrets: context.secrets,
    nowSeconds: context.nowSeconds,
  });
  if (!verification.valid) {
    console.warn(`Revalidate webhook rejected: ${verification.reason}`);
    return emptyResponse(401);
  }

  const event = contentEventSchema.safeParse(parseJson(body));
  if (!event.success) return emptyResponse(400);

  const tags = cacheTagsForEvent(event.data);
  for (const tag of tags.expireNow) context.revalidateTag(tag, { expire: 0 });
  for (const tag of tags.markStale) context.revalidateTag(tag, 'max');
  return Response.json({ revalidated: [...tags.expireNow, ...tags.markStale] });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

/** Невалідний JSON — `undefined`: схема його відкине (400). */
function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

/** Тіло рядком; довше за `maxBytes` — `null`, і далі не читаємо. */
async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
