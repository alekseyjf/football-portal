import { isApiError } from '@/lib/api/http';

/**
 * Запит блоку головної впав через недоступність API — мережа або 5xx. Відповідь з кодом 4xx (ліги з `?league=` немає —
 * 404) — це відповідь API, а не збій: блок покаже її сам.
 */
function isApiOutage(result: PromiseSettledResult<unknown>): boolean {
  if (result.status === 'fulfilled') return false;
  return !isApiError(result.reason) || result.reason.status >= 500;
}

/**
 * Блоки головної незалежні (D55): що не завантажилось на сервері — клієнт дотягне сам, і в блоці буде свій скелетон і
 * «Спробувати ще». Лише коли API недоступне для всіх запитів сторінки, вона віддає `error.tsx` — одне повідомлення
 * замість трьох однакових.
 */
export function isHomeApiDown(
  results: readonly PromiseSettledResult<unknown>[],
): boolean {
  return results.length > 0 && results.every(isApiOutage);
}
