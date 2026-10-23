import type { ContentLanguages } from './language.service';

export type TranslationLanguagesErrorCode =
  | 'DUPLICATE_TRANSLATION_LANGUAGE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'DEFAULT_TRANSLATION_REQUIRED'
  | 'ALL_TRANSLATIONS_REQUIRED';

/**
 * Які мови обов'язкові, коли контент створюється: `default` — лише default-мова (новина: без UK сайт покаже EN
 * з позначкою, D23); `all` — кожна увімкнена (назва тегу — EN і UK, D51: коротку назву перекладають одразу).
 */
export type RequiredTranslationLanguages = 'default' | 'all';

export interface TranslationLanguagesInput {
  /** Переклади з запиту (правило дивиться лише на мови) */
  translations: readonly { languageCode: string }[];
  /** Новина чи тег створюється. Наявні переклади вже є: видалити переклад не можна (P3-5) */
  isNew: boolean;
  required: RequiredTranslationLanguages;
  languages: ContentLanguages;
}

/**
 * Мови перекладів контенту — новини (D23, P3-3) і назв тегу (D17, D45, D51); `null` — переклади можна зберегти:
 * - кожна мова — увімкнена в `Language` і не більше одного разу;
 * - при створенні обов'язкова default-мова (`Language.isDefault`, а не код у правилі): з її тексту береться slug
 *   (заголовок новини — D24, назва тегу — D45); з `required: 'all'` — ще й кожна увімкнена мова (тег — D51);
 * - решта перекладів новини (UK) — опційні: без перекладу сайт показує default-мову з позначкою «переклад недоступний».
 */
export function findTranslationLanguagesError({
  translations,
  isNew,
  required,
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
  if (!isNew) return null;
  if (!seenLanguageCodes.has(languages.defaultCode)) {
    return 'DEFAULT_TRANSLATION_REQUIRED';
  }
  const hasEveryLanguage = [...languages.activeCodes].every((languageCode) =>
    seenLanguageCodes.has(languageCode),
  );
  if (required === 'all' && !hasEveryLanguage) {
    return 'ALL_TRANSLATIONS_REQUIRED';
  }
  return null;
}
