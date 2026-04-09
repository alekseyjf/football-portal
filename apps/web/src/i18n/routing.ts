import { defineRouting } from 'next-intl/routing';

/** Сегмент URL збігається з query `lang` у API (`en` | `ua`). */
export const routing = defineRouting({
  locales: ['en', 'ua'],
  defaultLocale: 'en',
  localePrefix: 'always',
  /** Cookie + Accept-Language (див. `accept-language.ts` для en → ua). */
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}
