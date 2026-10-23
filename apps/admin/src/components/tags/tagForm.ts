import type { TagFormValues, TagNamesFormValues } from '@football-portal/validation/forms';
import { isApiError } from '@/lib/api/http';
import type { AdminTag, CreateTagRequest, TagTranslationRequest, UpdateTagRequest } from '@/lib/api/types';
import { formServerErrorMessage } from '@/lib/formServerError';
import { tagNameIn } from '@/lib/tagNames';

/** Новий тег: усе порожнє, адреса — з англійської назви. */
export const EMPTY_TAG_FORM_VALUES: TagFormValues = { nameEn: '', nameUk: '', slug: '' };

/** Назви з форми (після перевірки — без країв, обидві є, D51) → назви в запиті. */
function toTagTranslations({ nameEn, nameUk }: TagNamesFormValues): TagTranslationRequest[] {
  return [
    { languageCode: 'en', name: nameEn },
    { languageCode: 'uk', name: nameUk },
  ];
}

/** Тіло `POST /tags`: порожню адресу не надсилаємо — API візьме її з англійської назви (D45). */
export function toCreateTagRequest(values: TagFormValues): CreateTagRequest {
  return { translations: toTagTranslations(values), ...(values.slug ? { slug: values.slug } : {}) };
}

/**
 * Поля перейменування — назви збереженого тегу, без країв: назва, записана сідом в обхід API, не стає «зміною», якої
 * редактор не робив (як текст новини, D50). Тег без української назви (в обхід API) — поле порожнє, і форма її вимагає.
 */
export function toTagNamesFormValues(tag: AdminTag): TagNamesFormValues {
  return { nameEn: tagNameIn(tag, 'en')?.trim() ?? '', nameUk: tagNameIn(tag, 'uk')?.trim() ?? '' };
}

/**
 * Тіло `PUT /tags/{id}` — лише змінені назви (як у новин, D50): незмінена не перезапише назву, яку тим часом виправив
 * інший адмін. `null` — змінювати нічого.
 */
export function toUpdateTagRequest(saved: TagNamesFormValues, values: TagNamesFormValues): UpdateTagRequest | null {
  const translations = toTagTranslations(values).filter(
    (translation) => translation.name !== (translation.languageCode === 'en' ? saved.nameEn : saved.nameUk),
  );
  return translations.length > 0 ? { translations } : null;
}

/** Коди `POST` / `PUT` / `DELETE /tags` → текст для редактора. */
const TAG_SERVER_ERROR_MESSAGES: Record<string, string> = {
  TAG_SLUG_TAKEN: 'A tag with this address already exists — use that tag, or type another address.',
  TAG_SLUG_REQUIRED: 'The English name has no latin letters or digits — type the address.',
  // Тег видалив інший адмін, поки форма була відкрита
  TAG_NOT_FOUND: 'This tag no longer exists — it was deleted.',
  DEFAULT_TRANSLATION_REQUIRED: 'The English name is required.',
  ALL_TRANSLATIONS_REQUIRED: 'Both names are required — English and Ukrainian.',
  UNSUPPORTED_LANGUAGE: 'One of the languages is not enabled.',
};

export function tagFormServerErrorMessage(error: unknown, submitLabel: string): string {
  return formServerErrorMessage(error, submitLabel, TAG_SERVER_ERROR_MESSAGES);
}

/** Помилка — про адресу: її показуємо біля поля адреси, а не над кнопкою. */
export function isTagSlugError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'TAG_SLUG_TAKEN' || error.code === 'TAG_SLUG_REQUIRED');
}
