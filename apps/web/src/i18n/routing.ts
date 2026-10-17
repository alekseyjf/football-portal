import { defineRouting } from 'next-intl/routing';

/** Сегмент URL = `Language.code` = query `lang` у API = `<html lang>` (`en` | `uk`, D22). */
export const routing = defineRouting({
  locales: ['en', 'uk'],
  defaultLocale: 'en',
  localePrefix: 'always',
  /** Cookie + Accept-Language: браузер шле стандартний `uk` / `uk-UA` — нормалізація не потрібна. */
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}
