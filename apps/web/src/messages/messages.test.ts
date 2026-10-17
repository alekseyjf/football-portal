import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

type MessageTree = { [key: string]: string | MessageTree };

function readCatalog(locale: string): MessageTree {
  const catalogUrl = new URL(`./${locale}.json`, import.meta.url);
  return JSON.parse(readFileSync(catalogUrl, 'utf8')) as MessageTree;
}

function messageKeys(messages: MessageTree, prefix = ''): string[] {
  return Object.entries(messages)
    .flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key}`]
        : messageKeys(value, `${prefix}${key}.`),
    )
    .sort();
}

const translatedLocales = routing.locales.filter(
  (locale) => locale !== routing.defaultLocale,
);

// Типи next-intl будуються лише з en.json: пропущений чи зайвий ключ в інших мовах tsc не бачить
describe.each(translatedLocales)('messages/%s.json', (locale) => {
  it('має ті самі ключі, що й en.json', () => {
    expect(messageKeys(readCatalog(locale))).toEqual(
      messageKeys(readCatalog(routing.defaultLocale)),
    );
  });
});
