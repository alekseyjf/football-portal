import type { ApiContentLanguage } from '@/lib/api/types';

/** Мапа сегмента URL → `lang` для GET /posts, /posts/:slug (коди збігаються, D22). */
export function localeToApiContentLang(locale: string): ApiContentLanguage {
  return locale === 'uk' ? 'uk' : 'en';
}

/** Назва мови контенту мовою інтерфейсу: `en` при locale `uk` → «англійська». */
export function contentLanguageName(languageCode: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([localeToBcp47(locale)], { type: 'language' }).of(
        languageCode,
      ) ?? languageCode
    );
  } catch {
    return languageCode;
  }
}

/** Тег для `Intl` (дати, числа) з регіоном: `uk-UA`, `en-GB`. */
export function localeToBcp47(locale: string): string {
  return locale === 'uk' ? 'uk-UA' : 'en-GB';
}
