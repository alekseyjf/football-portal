import type { ContentLanguages } from '../languages/language.service';

export type PostTranslationsErrorCode =
  | 'DUPLICATE_TRANSLATION_LANGUAGE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'DEFAULT_TRANSLATION_REQUIRED';

export interface PostTranslationsInput {
  /** Переклади з запиту (правило дивиться лише на мови) */
  translations: readonly { languageCode: string }[];
  /** Пост створюється. Наявний пост переклад default-мови вже має: видалити переклад не можна (P3-5) */
  isNewPost: boolean;
  languages: ContentLanguages;
}

/**
 * Мови перекладів поста (D23, P3-3); `null` — переклади можна зберегти:
 * - кожна мова — увімкнена в `Language` і не більше одного разу;
 * - обов'язкова лише default-мова (`Language.isDefault`, а не код у правилі): з її заголовка береться slug (D24);
 * - решта (UK) — опційні: без перекладу сайт показує default-мову з позначкою «переклад недоступний».
 */
export function findPostTranslationsError({
  translations,
  isNewPost,
  languages,
}: PostTranslationsInput): PostTranslationsErrorCode | null {
  const seenLanguageCodes = new Set<string>();
  for (const { languageCode } of translations) {
    if (seenLanguageCodes.has(languageCode)) {
      return 'DUPLICATE_TRANSLATION_LANGUAGE';
    }
    seenLanguageCodes.add(languageCode);
    if (!languages.activeCodes.has(languageCode)) return 'UNSUPPORTED_LANGUAGE';
  }
  if (isNewPost && !seenLanguageCodes.has(languages.defaultCode)) {
    return 'DEFAULT_TRANSLATION_REQUIRED';
  }
  return null;
}
