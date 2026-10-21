import type { ContentLanguages } from './language.service';

export type TranslationLanguagesErrorCode =
  | 'DUPLICATE_TRANSLATION_LANGUAGE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'DEFAULT_TRANSLATION_REQUIRED';

export interface TranslationLanguagesInput {
  /** Переклади з запиту (правило дивиться лише на мови) */
  translations: readonly { languageCode: string }[];
  /** Новина чи тег створюється. Наявні переклад default-мови вже мають: видалити його не можна (P3-5) */
  isNew: boolean;
  languages: ContentLanguages;
}

/**
 * Мови перекладів контенту — новини (D23, P3-3) і назв тегу (D17, D45); `null` — переклади можна зберегти:
 * - кожна мова — увімкнена в `Language` і не більше одного разу;
 * - обов'язкова лише default-мова (`Language.isDefault`, а не код у правилі): з її тексту береться slug
 *   (заголовок новини — D24, назва тегу — D45);
 * - решта (UK) — опційні: без перекладу сайт показує default-мову (новину — з позначкою «переклад недоступний»).
 */
export function findTranslationLanguagesError({
  translations,
  isNew,
  languages,
}: TranslationLanguagesInput): TranslationLanguagesErrorCode | null {
  const seenLanguageCodes = new Set<string>();
  for (const { languageCode } of translations) {
    if (seenLanguageCodes.has(languageCode)) {
      return 'DUPLICATE_TRANSLATION_LANGUAGE';
    }
    seenLanguageCodes.add(languageCode);
    if (!languages.activeCodes.has(languageCode)) return 'UNSUPPORTED_LANGUAGE';
  }
  if (isNew && !seenLanguageCodes.has(languages.defaultCode)) {
    return 'DEFAULT_TRANSLATION_REQUIRED';
  }
  return null;
}
