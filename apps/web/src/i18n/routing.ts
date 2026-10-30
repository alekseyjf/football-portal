import { defineRouting } from 'next-intl/routing';

/** Сегмент URL = `Language.code` = query `lang` у API = `<html lang>` (`en` | `uk`, D22). */
export const routing = defineRouting({
  locales: ['en', 'uk'],
  defaultLocale: 'en',
  localePrefix: 'always',
  /** Cookie + Accept-Language: браузер шле стандартний `uk` / `uk-UA` — нормалізація не потрібна. */
  localeDetection: true,
  /**
   * Без HTTP-заголовка `Link` з `hreflang` на кожну сторінку: мовні версії знає лише сторінка (новина без UK-перекладу
   * — без `uk`, фільтри стрічки — без `hreflang`), і їх пише `pageMetadata` (`lib/seo/page-metadata.ts`, D34)
   */
  alternateLinks: false,
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}
