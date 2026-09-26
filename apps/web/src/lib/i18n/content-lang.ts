import type { ApiContentLanguage } from '@/lib/api/types';

/** Мапа сегмента URL → `lang` для GET /posts, /posts/:slug. */
export function localeToApiContentLang(locale: string): ApiContentLanguage {
  return locale === 'ua' ? 'ua' : 'en';
}

/**
 * `Language.code` контенту → BCP47 для атрибута `lang` і `Intl.DisplayNames`:
 * у нас українська — `ua` (як сегмент URL), стандартний код — `uk`.
 */
export function contentLangToBcp47(languageCode: string): string {
  return languageCode === 'ua' ? 'uk' : languageCode;
}

/** Назва мови контенту мовою інтерфейсу: `en` при locale `ua` → «англійська». */
export function contentLanguageName(languageCode: string, locale: string): string {
  try {
    return (
      new Intl.DisplayNames([localeToBcp47(locale)], { type: 'language' }).of(
        contentLangToBcp47(languageCode),
      ) ?? languageCode
    );
  } catch {
    return languageCode;
  }
}

/** Тег для `Intl` / `toLocaleDateString` (українська в UI при locale `ua`). */
export function localeToBcp47(locale: string): string {
  return locale === 'ua' ? 'uk-UA' : 'en-GB';
}
