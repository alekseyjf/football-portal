/**
 * Адреси сторінок сайту — одна функція на сторінку для маршруту, посилань і прев'ю в адмінці: формат адреси —
 * рішення (D51), а не рядок, який кожен збирає сам.
 */

/**
 * Сторінка тегу `/{locale}/news/tag/{slug}` (D45, D51). Slug — у форматі `SLUG_PATTERN` (його тримає й CHECK у БД),
 * тож кодувати нічого.
 */
export function publicTagPath(locale: string, slug: string): string {
  return `/${locale}/news/tag/${slug}`;
}
