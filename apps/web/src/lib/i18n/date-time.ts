import { localeToBcp47 } from './content-lang';

/** Форматери за `(мова, пояс, опції)`: у списках (тури, коментарі) — десятки дат за рендер. */
const formatterByKey = new Map<string, Intl.DateTimeFormat>();
const FORMATTER_CACHE_LIMIT = 200;

/**
 * Дата / час для UI — лише через цю функцію (у клієнтських компонентах — `useDateTimeFormat`).
 * Пояс — завжди явний, з конфігу next-intl: `toLocaleString` без `timeZone` бере пояс процесу,
 * і SSR (UTC на сервері) розходиться з браузером (Київ) → hydration mismatch.
 * Мова — BCP47 (`ua` → `uk-UA`, `en` → `en-GB`), як і раніше.
 *
 * @param options без полів дати / часу — числова дата (як `toLocaleDateString()`)
 */
export function formatDateTime(
  value: string | Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const cacheKey = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let formatter = formatterByKey.get(cacheKey);
  if (!formatter) {
    if (formatterByKey.size >= FORMATTER_CACHE_LIMIT) formatterByKey.clear();
    formatter = new Intl.DateTimeFormat(localeToBcp47(locale), {
      ...options,
      timeZone,
    });
    formatterByKey.set(cacheKey, formatter);
  }
  return formatter.format(typeof value === 'string' ? new Date(value) : value);
}
