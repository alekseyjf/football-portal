'use client';

import { useEffect } from 'react';
import { useTimeZone } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  isValidTimeZone,
  TIME_ZONE_COOKIE,
  TIME_ZONE_COOKIE_MAX_AGE_SECONDS,
} from '@/i18n/time-zone';

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookiePart = document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix));
  return cookiePart ? decodeURIComponent(cookiePart.slice(prefix.length)) : null;
}

/** `Europe/Kyiv` і `Europe/Kiev` — один пояс: Chrome / Node віддають `Kiev` з `resolvedOptions()`. */
function isSameTimeZone(leftTimeZone: string, rightTimeZone: string): boolean {
  const canonicalName = (timeZone: string) =>
    new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
  return canonicalName(leftTimeZone) === canonicalName(rightTimeZone);
}

/**
 * Пояс браузера → cookie `tz` → сервер форматує дати в ньому (`i18n/request.ts`).
 * Перший візит (cookie ще немає) рендериться в поясі за замовчуванням; якщо браузер в іншому —
 * один `router.refresh()`, далі сервер одразу знає пояс. Гідрація завжди в поясі сервера.
 */
export function TimeZoneSync() {
  const renderedTimeZone = useTimeZone();
  const router = useRouter();

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (
      !isValidTimeZone(browserTimeZone) ||
      (isValidTimeZone(renderedTimeZone) &&
        isSameTimeZone(browserTimeZone, renderedTimeZone))
    ) {
      return;
    }
    // Без кодування: `isValidTimeZone` пускає лише `[A-Za-z0-9_+-/]` — допустимі символи cookie
    document.cookie = `${TIME_ZONE_COOKIE}=${browserTimeZone}; path=/; max-age=${TIME_ZONE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    // Cookies заблоковані — без refresh, інакше він повторювався б на кожному завантаженні
    if (readCookie(TIME_ZONE_COOKIE) !== browserTimeZone) return;
    router.refresh();
  }, [renderedTimeZone, router]);

  return null;
}
