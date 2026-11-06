/**
 * Помилки zod-схем форм (M1.9): у схемі — ключ `validation.<поле>.<правило>`, текст — у застосунку: сайт перекладає
 * ключ через `messages` (en / uk), адмінка — своєю мапою англійською. Числа тексту — з issue: межа вбудованої перевірки
 * (`minimum` / `maximum`) чи `params` власної (`refine`); значення в каталозі — імена цих параметрів.
 */
import type { z } from 'zod';

type FormErrorParamName = 'minimum' | 'maximum' | 'maxBytes';
type FormErrorCatalog = Record<`validation.${string}.${string}`, readonly FormErrorParamName[]>;

/** Форми сайту (вхід, реєстрація, коментар): ці ключі — у `messages` web, кожною мовою (тест web). */
export const SITE_FORM_ERRORS = {
  'validation.email.tooLong': ['maximum'],
  'validation.email.invalid': [],
  'validation.password.required': [],
  'validation.password.tooLong': [],
  'validation.password.tooShort': ['minimum'],
  'validation.password.tooManyBytes': ['maxBytes'],
  'validation.name.tooShort': ['minimum'],
  'validation.name.tooLong': ['maximum'],
  'validation.confirmPassword.mismatch': [],
  'validation.comment.tooShort': ['minimum'],
  'validation.comment.tooLong': ['maximum'],
} as const satisfies FormErrorCatalog;

/** Форми редактора (новина, тег) — лише адмінка: сайт передає клієнту всі `messages`, тож там вони були б зайві. */
export const EDITOR_FORM_ERRORS = {
  'validation.url.tooLong': ['maximum'],
  'validation.mediaUrl.notHttps': [],
  'validation.coverImageUrl.notPhotoBank': [],
  'validation.videoUrl.notYouTube': [],
  'validation.title.tooShort': ['minimum'],
  'validation.title.tooLong': ['maximum'],
  'validation.excerpt.tooShort': ['minimum'],
  'validation.excerpt.tooLong': ['maximum'],
  'validation.content.tooShort': ['minimum'],
  'validation.content.tooLong': ['maximum'],
  'validation.coverImageAlt.tooLong': ['maximum'],
  'validation.coverImageCredit.tooLong': ['maximum'],
  'validation.slug.tooLong': ['maximum'],
  'validation.slug.invalid': [],
  'validation.sourceUrl.notHttp': [],
  'validation.sourceName.tooLong': ['maximum'],
  'validation.tagName.tooShort': ['minimum'],
  'validation.tagName.tooLong': ['maximum'],
  'validation.tagSlug.required': [],
} as const satisfies FormErrorCatalog;

export type SiteFormErrorKey = keyof typeof SITE_FORM_ERRORS;
export type FormErrorKey = SiteFormErrorKey | keyof typeof EDITOR_FORM_ERRORS;
export type FormErrorParams = Readonly<Record<string, number>>;
export type FormIssue = z.core.$ZodIssue;

export function isSiteFormErrorKey(message: string): message is SiteFormErrorKey {
  return Object.hasOwn(SITE_FORM_ERRORS, message);
}

export function isFormErrorKey(message: string): message is FormErrorKey {
  return isSiteFormErrorKey(message) || Object.hasOwn(EDITOR_FORM_ERRORS, message);
}

/** Числа для тексту помилки: межа вбудованої перевірки чи числові `params` власної. */
export function formErrorParams(issue: FormIssue): FormErrorParams {
  switch (issue.code) {
    case 'too_small':
      return { minimum: Number(issue.minimum) };
    case 'too_big':
      return { maximum: Number(issue.maximum) };
    case 'custom':
      return Object.fromEntries(
        Object.entries(issue.params ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      );
    default:
      return {};
  }
}

/**
 * Помилки полів для React Hook Form — як у `zodResolver`: перша на поле, з union — перша гілки. Текст дає `translate`
 * з усього issue: `zodResolver` лишає лише `message`, і числа меж губляться.
 */
export function formFieldErrors(
  issues: readonly FormIssue[],
  translate: (issue: FormIssue) => string,
): Record<string, { type: string; message: string }> {
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of issues) {
    const fieldPath = issue.path.join('.');
    if (Object.hasOwn(errors, fieldPath)) continue;
    const shownIssue = (issue.code === 'invalid_union' && issue.errors[0]?.[0]) || issue;
    errors[fieldPath] = { type: shownIssue.code, message: translate(shownIssue) };
  }
  return errors;
}
