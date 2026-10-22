import { isApiError } from '@/lib/api/http';

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
  TOO_MANY_REQUESTS: 'Too many requests — try again in a minute.',
};

export function postFormServerErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  if (error.status === 403) return 'Access denied — admin account required.';
  return SERVER_ERROR_MESSAGES[error.code] ?? error.code;
}
