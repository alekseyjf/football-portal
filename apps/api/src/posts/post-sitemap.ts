/*
 * Межі sitemap новин (D57). Адреса — новина однією мовою (`/{locale}/news/{slug}-{number}`), тож новин у файлі —
 * межа адрес, поділена на кількість увімкнених мов: кожна новина може мати переклад кожною.
 */

/** Адрес в одному файлі sitemap — межа протоколу sitemaps.org і Google. */
export const SITEMAP_URL_LIMIT = 50_000;
/** Адрес у Google News sitemap — межа Google. */
export const NEWS_SITEMAP_URL_LIMIT = 1000;
/** Google News sitemap — лише новини за останні 48 год (вимога Google). */
export const NEWS_SITEMAP_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Найбільше новин у файлі з межею `urlLimit` адрес, коли мов `languageCount`. */
export function sitemapPostLimit(
  urlLimit: number,
  languageCount: number,
): number {
  return Math.floor(urlLimit / Math.max(languageCount, 1));
}

/** Межі місяця `2026-10` в UTC: `[start, end)`. Формат перевірив DTO (`SITEMAP_MONTH_PATTERN`). */
export function sitemapMonthRange(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    // Date.UTC переносить 13-й місяць на січень наступного року
    end: new Date(Date.UTC(year, monthNumber, 1)),
  };
}
