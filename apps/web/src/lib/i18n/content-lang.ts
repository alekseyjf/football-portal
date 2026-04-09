import type { ApiContentLanguage } from '@/lib/api/types';

/** Мапа сегмента URL → `lang` для GET /posts, /posts/:slug. */
export function localeToApiContentLang(locale: string): ApiContentLanguage {
  return locale === 'ua' ? 'ua' : 'en';
}

/** Тег для `Intl` / `toLocaleDateString` (українська в UI при locale `ua`). */
export function localeToBcp47(locale: string): string {
  return locale === 'ua' ? 'uk-UA' : 'en-GB';
}
