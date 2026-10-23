import { isApiError } from '@/lib/api/http';

/** Коди, однакові для всіх форм адмінки. */
const COMMON_SERVER_ERROR_MESSAGES: Record<string, string> = {
  TOO_MANY_REQUESTS: 'Too many requests — try again in a minute.',
};

/**
 * Помилка API при збереженні форми → текст для редактора. `messages` — тексти кодів цієї форми; `submitLabel` — напис
 * кнопки збереження: після входу в новій вкладці редактор натискає саме її.
 */
export function formServerErrorMessage(
  error: unknown,
  submitLabel: string,
  messages: Record<string, string>,
): string {
  if (!isApiError(error)) return 'Something went wrong';
  // Сесія скінчилась (refresh відхилено): форма з текстом лишається, на логін адмінка не переводить (D50)
  if (error.status === 401) {
    return `Your session has expired — log in again in a new tab, then click “${submitLabel}” here once more.`;
  }
  if (error.status === 403) return 'Access denied — admin account required.';
  return messages[error.code] ?? COMMON_SERVER_ERROR_MESSAGES[error.code] ?? error.code;
}
