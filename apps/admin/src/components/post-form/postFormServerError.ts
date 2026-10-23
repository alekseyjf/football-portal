import { formServerErrorMessage } from '@/lib/formServerError';

/**
 * Коди помилок `POST` / `PUT /posts` → текст для редактора. Майже всі ці правила форма перевіряє ще до
 * відправлення; від API вони приходять, коли стан змінився між перевіркою і запитом (час розкладу минув).
 */
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  SCHEDULED_AT_IN_PAST: 'Scheduled time is already in the past — pick a later time.',
  PUBLISHED_AT_REQUIRED: 'Choose when the post goes live.',
  PUBLISHED_AT_IN_FUTURE: 'A published post cannot have a future date — use Schedule.',
  DEFAULT_TRANSLATION_REQUIRED: 'The English version is required.',
  UNSUPPORTED_LANGUAGE: 'One of the languages is not enabled.',
  COVER_IMAGE_ALT_REQUIRED: 'Describe the cover photo in every language of the post — required to publish.',
  COVER_IMAGE_CREDIT_REQUIRED: 'Credit the author of the cover photo — required to publish.',
  SOURCE_URL_REQUIRED: 'Add the source article URL — the source name is shown only with it.',
  // Редагування: новину видалили, поки форма була відкрита
  POST_NOT_FOUND: 'This post no longer exists — it was deleted.',
};

/** `submitLabel` — напис кнопки збереження: після входу в новій вкладці редактор натискає саме її. */
export function postFormServerErrorMessage(error: unknown, submitLabel: string): string {
  return formServerErrorMessage(error, submitLabel, SERVER_ERROR_MESSAGES);
}
