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
  // Зв'язок зник, поки форма була відкрита. Тег, який видалили, форма прибирає сама й називає (`useVanishedTagsRecovery`);
  // ці тексти — коли не вийшло перечитати список. Клуби й турніри не видаляються — на всяк випадок
  UNKNOWN_TAG: 'One of the tags no longer exists — it was deleted. Reload the page and pick the tags again.',
  UNKNOWN_CLUB: 'One of the clubs no longer exists — reload the page and pick the clubs again.',
  UNKNOWN_COMPETITION: 'One of the competitions no longer exists — reload the page and pick the competitions again.',
};

/** `submitLabel` — напис кнопки збереження: після входу в новій вкладці редактор натискає саме її. */
export function postFormServerErrorMessage(error: unknown, submitLabel: string): string {
  return formServerErrorMessage(error, submitLabel, SERVER_ERROR_MESSAGES);
}

/**
 * Теги, які видалили, поки форма була відкрита (D51): форма їх уже прибрала з новини. `tagNames` — назви тих, кого
 * форма знала (порожньо — без імен); `submitLabel` — кнопка, яку натиснути ще раз, `null` — інших змін немає, зберігати
 * нічого.
 */
export function vanishedTagsMessage(tagNames: readonly string[], submitLabel: string | null): string {
  const quotedNames = tagNames.map((name) => `“${name}”`);
  const lastName = quotedNames[quotedNames.length - 1];
  const isPlural = quotedNames.length > 1;
  let subject = 'A tag was';
  if (quotedNames.length === 1) subject = `The tag ${lastName} was`;
  if (isPlural) subject = `The tags ${quotedNames.slice(0, -1).join(', ')} and ${lastName} were`;
  const removed = `${subject} deleted while you were editing, so ${isPlural ? 'they’re' : 'it’s'} removed from this post`;
  return submitLabel
    ? `${removed} — click “${submitLabel}” again.`
    : `${removed}. Nothing else has changed — there’s nothing to save.`;
}
