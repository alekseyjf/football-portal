/**
 * Zod-схеми форм web / admin. Числа — з `./index` (ті самі, що в DTO API),
 * тож клієнтська і серверна валідація не розходяться. Помилка — ключ, а не текст (`./form-errors`, M1.9).
 */
import { z } from 'zod';
import type { FormErrorKey } from './form-errors';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
  isAllowedCoverImageUrl,
  MEDIA_URL_PROTOCOLS,
  PASSWORD_INPUT_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  POST_CONTENT_MAX_LENGTH,
  POST_CONTENT_MIN_LENGTH,
  POST_COVER_IMAGE_ALT_MAX_LENGTH,
  POST_COVER_IMAGE_CREDIT_MAX_LENGTH,
  POST_EXCERPT_MAX_LENGTH,
  POST_EXCERPT_MIN_LENGTH,
  POST_SLUG_MAX_LENGTH,
  POST_SOURCE_NAME_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
  SLUG_PATTERN,
  slugifyTagName,
  SOURCE_URL_PROTOCOLS,
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  TAG_SLUG_MAX_LENGTH,
  URL_MAX_LENGTH,
  utf8ByteLength,
} from './index';
import { parseYouTubeVideoId } from './youtube';

export {
  EDITOR_FORM_ERRORS,
  formErrorParams,
  formFieldErrors,
  isFormErrorKey,
  isSiteFormErrorKey,
  SITE_FORM_ERRORS,
  type FormErrorKey,
  type FormErrorParams,
  type FormIssue,
  type SiteFormErrorKey,
} from './form-errors';

/** Ключ з каталогу помилок: друкарську помилку в ньому ловить TypeScript, а не читач, що побачив би загальну. */
const errorKey = (key: FormErrorKey) => key;

// ─── Поля ───

export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX_LENGTH, errorKey('validation.email.tooLong'))
  .email(errorKey('validation.email.invalid'));

/** Новий пароль — політика довжини. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, errorKey('validation.password.tooShort'))
  .refine((password) => utf8ByteLength(password) <= PASSWORD_MAX_BYTES, {
    message: errorKey('validation.password.tooManyBytes'),
    params: { maxBytes: PASSWORD_MAX_BYTES },
  });

/** Введений пароль (логін): без мінімуму — старі акаунти мають коротші паролі. */
export const currentPasswordSchema = z
  .string()
  .min(1, errorKey('validation.password.required'))
  .max(PASSWORD_INPUT_MAX_LENGTH, errorKey('validation.password.tooLong'));

export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, errorKey('validation.name.tooShort'))
  .max(DISPLAY_NAME_MAX_LENGTH, errorKey('validation.name.tooLong'));

export const commentContentSchema = z
  .string()
  .trim()
  .min(COMMENT_MIN_LENGTH, errorKey('validation.comment.tooShort'))
  .max(COMMENT_MAX_LENGTH, errorKey('validation.comment.tooLong'));

/** Адреса обкладинки — лише https (як `@IsMediaUrl()` у DTO постів). */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, errorKey('validation.url.tooLong'))
  .refine(
    (value) => hasAllowedProtocol(value, MEDIA_URL_PROTOCOLS),
    errorKey('validation.mediaUrl.notHttps'),
  );

/**
 * Нова адреса обкладинки (M1.8.3a): https і фото з фотобанку зі списку — та сама перевірка, що в API
 * (`COVER_IMAGE_HOST_NOT_ALLOWED`). Збережену адресу з іншого хоста API приймає без змін, тож форма редагування
 * перевіряє цією схемою лише змінену.
 */
export const coverImageUrlSchema = mediaUrlSchema.refine(
  isAllowedCoverImageUrl,
  errorKey('validation.coverImageUrl.notPhotoBank'),
);

/**
 * Відео новини (D54) — посилання YouTube у звичних формах (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`), як
 * `@IsYouTubeVideoUrl()` у DTO: перевіряє та сама функція. API збереже його канонічним.
 */
export const youtubeVideoUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, errorKey('validation.url.tooLong'))
  .refine(
    (value) => parseYouTubeVideoId(value) !== null,
    errorKey('validation.videoUrl.notYouTube'),
  );

/** Поля перекладу поста (форма адмінки). */
export const postTitleSchema = z
  .string()
  .trim()
  .min(POST_TITLE_MIN_LENGTH, errorKey('validation.title.tooShort'))
  .max(POST_TITLE_MAX_LENGTH, errorKey('validation.title.tooLong'));

export const postExcerptSchema = z
  .string()
  .trim()
  .min(POST_EXCERPT_MIN_LENGTH, errorKey('validation.excerpt.tooShort'))
  .max(POST_EXCERPT_MAX_LENGTH, errorKey('validation.excerpt.tooLong'));

export const postContentSchema = z
  .string()
  .trim()
  .min(POST_CONTENT_MIN_LENGTH, errorKey('validation.content.tooShort'))
  .max(POST_CONTENT_MAX_LENGTH, errorKey('validation.content.tooLong'));

/**
 * Опис обкладинки для незрячих і підпис автора фото (D44). Порожні — можна: обов'язкові вони лише
 * для публікації з обкладинкою, і це правило форма перевіряє разом з іншими полями.
 */
export const postCoverImageAltSchema = z
  .string()
  .trim()
  .max(POST_COVER_IMAGE_ALT_MAX_LENGTH, errorKey('validation.coverImageAlt.tooLong'));

export const postCoverImageCreditSchema = z
  .string()
  .trim()
  .max(POST_COVER_IMAGE_CREDIT_MAX_LENGTH, errorKey('validation.coverImageCredit.tooLong'));

/** Явний slug новини (D24) — як `@Matches(SLUG_PATTERN)` у DTO API. */
export const postSlugSchema = z
  .string()
  .trim()
  .max(POST_SLUG_MAX_LENGTH, errorKey('validation.slug.tooLong'))
  .regex(SLUG_PATTERN, errorKey('validation.slug.invalid'));

/** Посилання на джерело новини (D26) — http(s), як `@IsSourceUrl()` у DTO. */
export const sourceUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, errorKey('validation.url.tooLong'))
  .refine(
    (value) => hasAllowedProtocol(value, SOURCE_URL_PROTOCOLS),
    errorKey('validation.sourceUrl.notHttp'),
  );

/** Назва джерела («BBC Sport», D26). Порожня — можна: сайт покаже домен адреси. */
export const postSourceNameSchema = z
  .string()
  .trim()
  .max(POST_SOURCE_NAME_MAX_LENGTH, errorKey('validation.sourceName.tooLong'));

/** Назва тегу однією мовою (D45) — як `@Length(TAG_NAME_*)` у DTO API. */
export const tagNameSchema = z
  .string()
  .trim()
  .min(TAG_NAME_MIN_LENGTH, errorKey('validation.tagName.tooShort'))
  .max(TAG_NAME_MAX_LENGTH, errorKey('validation.tagName.tooLong'));

/** Явний slug тегу (D45) — як `@Matches(SLUG_PATTERN)` у `CreateTagDto`. */
export const tagSlugSchema = z
  .string()
  .trim()
  .max(TAG_SLUG_MAX_LENGTH, errorKey('validation.slug.tooLong'))
  .regex(SLUG_PATTERN, errorKey('validation.slug.invalid'));

/** Необов'язкове поле форми: порожнє чи з самих пробілів — «не задано», інакше — за схемою. */
function optionalFormField(schema: z.ZodType<string, string>) {
  return z.string().trim().pipe(schema.or(z.literal('')));
}

function hasAllowedProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol.replace(/:$/, ''));
  } catch {
    return false;
  }
}

// ─── Форми ───

export const loginFormSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    name: displayNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: errorKey('validation.confirmPassword.mismatch'),
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const commentFormSchema = z.object({
  content: commentContentSchema,
});
export type CommentFormValues = z.infer<typeof commentFormSchema>;

/**
 * Назви тегу (D45, D51): англійська й українська — обидві обов'язкові, як в API. Після перевірки — без пробілів
 * по краях, як їх збереже API.
 */
export const tagNamesFormSchema = z.object({
  nameEn: tagNameSchema,
  nameUk: tagNameSchema,
});
export type TagNamesFormValues = z.infer<typeof tagNamesFormSchema>;

/**
 * Новий тег (D45): назви й адреса. Порожня адреса — з англійської назви (`slugifyTagName`, як в API); назву без
 * латиниці й цифр API не перетворить на адресу (`TAG_SLUG_REQUIRED`) — тоді її вписують.
 */
export const tagFormSchema = tagNamesFormSchema
  .extend({ slug: optionalFormField(tagSlugSchema) })
  .superRefine((values, ctx) => {
    if (values.slug || slugifyTagName(values.nameEn) !== null) return;
    ctx.addIssue({
      code: 'custom',
      path: ['slug'],
      message: errorKey('validation.tagSlug.required'),
    });
  });
export type TagFormValues = z.infer<typeof tagFormSchema>;
