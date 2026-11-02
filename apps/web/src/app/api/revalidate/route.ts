import { revalidateTag } from 'next/cache';
import { handleRevalidateRequest } from '@/lib/revalidate/revalidate-request';
import { revalidateSecrets } from '@/lib/revalidate/verify';

// `node:crypto` (HMAC, `timingSafeEqual`) — лише в Node
export const runtime = 'nodejs';

/** Вебхук API (D57): подія новини чи головної → теги кешу даних. Правило й перевірки — `handleRevalidateRequest`. */
export function POST(request: Request) {
  return handleRevalidateRequest(request, {
    secrets: revalidateSecrets(),
    nowSeconds: Math.floor(Date.now() / 1000),
    revalidateTag,
  });
}
