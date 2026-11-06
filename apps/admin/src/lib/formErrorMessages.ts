import { COVER_IMAGE_HOSTS, coverImageUrlExample } from '@football-portal/validation';
import {
  formErrorParams,
  isFormErrorKey,
  type FormErrorKey,
  type FormErrorParams,
  type FormIssue,
} from '@football-portal/validation/forms';

/** Невідомий ключ спільної схеми — загальна помилка, а не сирий ключ. */
export const GENERIC_FORM_ERROR = 'Invalid value';

const COVER_IMAGE_SOURCES = new Intl.ListFormat('en', { type: 'disjunction' }).format(
  COVER_IMAGE_HOSTS.map((host) => `${host.name} (${coverImageUrlExample(host)})`),
);

/**
 * Тексти помилок спільних схем (M1.9) — англійською, як були в схемах до ключів: сайт перекладає ті самі ключі через
 * `messages`, адмінка — лише англійська. Числа — з issue (`formErrorParams`).
 */
const FORM_ERROR_TEXTS: Record<FormErrorKey, (params: FormErrorParams) => string> = {
  'validation.email.tooLong': ({ maximum }) => `Email must be at most ${maximum} characters`,
  'validation.email.invalid': () => 'Invalid email address',
  'validation.password.required': () => 'Password is required',
  'validation.password.tooLong': () => 'Password is too long',
  'validation.password.tooShort': ({ minimum }) => `Password must be at least ${minimum} characters`,
  'validation.password.tooManyBytes': ({ maxBytes }) =>
    `Password is too long: at most ${maxBytes} bytes (a non-Latin letter takes 2)`,
  'validation.name.tooShort': ({ minimum }) => `Name must be at least ${minimum} characters`,
  'validation.name.tooLong': ({ maximum }) => `Name must be at most ${maximum} characters`,
  'validation.confirmPassword.mismatch': () => "Passwords don't match",
  'validation.comment.tooShort': ({ minimum }) => `Comment must be at least ${minimum} characters`,
  'validation.comment.tooLong': ({ maximum }) => `Comment must be at most ${maximum} characters`,
  'validation.url.tooLong': ({ maximum }) => `URL must be at most ${maximum} characters`,
  'validation.mediaUrl.notHttps': () => 'Must be an https:// URL',
  'validation.coverImageUrl.notPhotoBank': () =>
    `Use a photo from ${COVER_IMAGE_SOURCES} — right-click the photo → Copy image address`,
  'validation.videoUrl.notYouTube': () =>
    'Paste a YouTube video link: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… or /embed/…',
  'validation.title.tooShort': ({ minimum }) => `Title must be at least ${minimum} characters`,
  'validation.title.tooLong': ({ maximum }) => `Title must be at most ${maximum} characters`,
  'validation.excerpt.tooShort': ({ minimum }) => `Excerpt must be at least ${minimum} characters`,
  'validation.excerpt.tooLong': ({ maximum }) => `Excerpt must be at most ${maximum} characters`,
  'validation.content.tooShort': ({ minimum }) => `Content must be at least ${minimum} characters`,
  'validation.content.tooLong': ({ maximum }) => `Content must be at most ${maximum} characters`,
  'validation.coverImageAlt.tooLong': ({ maximum }) => `Alt text must be at most ${maximum} characters`,
  'validation.coverImageCredit.tooLong': ({ maximum }) => `Credit must be at most ${maximum} characters`,
  'validation.slug.tooLong': ({ maximum }) => `Slug must be at most ${maximum} characters`,
  'validation.slug.invalid': () => 'Use lowercase latin letters and digits, words joined by single hyphens',
  'validation.sourceUrl.notHttp': () => 'Must be an http:// or https:// URL',
  'validation.sourceName.tooLong': ({ maximum }) => `Source name must be at most ${maximum} characters`,
  'validation.tagName.tooShort': ({ minimum }) => `Name must be at least ${minimum} characters`,
  'validation.tagName.tooLong': ({ maximum }) => `Name must be at most ${maximum} characters`,
  'validation.tagSlug.required': () => 'The English name has no latin letters or digits — type the address',
};

/**
 * Текст помилки поля. Не ключ — власне правило форми адмінки (`postFormSchema.ts`, уже англійською) чи текст zod за
 * замовчуванням: показуємо як є; ключ `validation.*`, якого немає в мапі, — загальна помилка.
 */
export function formIssueMessage(issue: FormIssue): string {
  if (isFormErrorKey(issue.message)) return FORM_ERROR_TEXTS[issue.message](formErrorParams(issue));
  return issue.message.startsWith('validation.') ? GENERIC_FORM_ERROR : issue.message;
}
