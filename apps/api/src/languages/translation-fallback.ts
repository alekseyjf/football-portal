import type { ContentLanguageChoice } from './language.service';

/*
 * Fallback перекладу при читанні (розділ 8, P3-4) — однаковий для новин і назв тегів (D17): запитана мова,
 * без неї — default-мова (`en`).
 */

/** Мови, переклади якими читаємо з БД: запитана й default — з N мовами не тягнемо решту. */
export function languageCodesToLoad(
  languageChoice: ContentLanguageChoice,
): string[] {
  return [
    ...new Set([languageChoice.requestedCode, languageChoice.defaultCode]),
  ];
}

/** Переклад запитаною мовою, без нього — default-мовою; `undefined` — немає жодного з двох. */
export function pickTranslation<Translation extends { languageCode: string }>(
  translations: Translation[],
  languageChoice: ContentLanguageChoice,
): Translation | undefined {
  return (
    translations.find(
      (translation) =>
        translation.languageCode === languageChoice.requestedCode,
    ) ??
    translations.find(
      (translation) => translation.languageCode === languageChoice.defaultCode,
    )
  );
}
