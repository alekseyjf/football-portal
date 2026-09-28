/**
 * Часовий пояс дат у UI. SSR і клієнт мають форматувати в **одному** поясі (інакше сервер у UTC
 * і браузер у Києві дають різний HTML → hydration mismatch), тому пояс — частина конфігу
 * next-intl (`i18n/request.ts`), а `NextIntlClientProvider` передає його клієнту.
 *
 * Джерело — cookie `tz` з поясом браузера (пише `TimeZoneSync`); без неї — `DEFAULT_TIME_ZONE`.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

export const TIME_ZONE_COOKIE = 'tz';

/** Рік: пояс браузера змінюється рідко, а `TimeZoneSync` перезапише cookie, якщо він інший. */
export const TIME_ZONE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const TIME_ZONE_NAME_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;

/**
 * IANA-пояс, який розуміє `Intl`. Значення cookie надсилає клієнт: невідомий пояс у `Intl`
 * кидає `RangeError`, тож на сервері — лише після цієї перевірки.
 */
export function isValidTimeZone(
  timeZone: string | null | undefined,
): timeZone is string {
  if (!timeZone || !TIME_ZONE_NAME_PATTERN.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(cookieTimeZone: string | undefined): string {
  return isValidTimeZone(cookieTimeZone) ? cookieTimeZone : DEFAULT_TIME_ZONE;
}
