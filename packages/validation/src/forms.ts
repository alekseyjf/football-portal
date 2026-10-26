/**
 * Zod-схеми форм web / admin. Числа — з `./index` (ті самі, що в DTO API),
 * тож клієнтська і серверна валідація не розходяться.
 */
import { z } from 'zod';
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
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

// ─── Поля ───

export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  .email('Invalid email address');

/** Новий пароль — політика довжини. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine(
    (password) => utf8ByteLength(password) <= PASSWORD_MAX_BYTES,
    `Password is too long: at most ${PASSWORD_MAX_BYTES} bytes (a non-Latin letter takes 2)`,
  );

/** Введений пароль (логін): без мінімуму — старі акаунти мають коротші паролі. */
export const currentPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(PASSWORD_INPUT_MAX_LENGTH, 'Password is too long');

export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN_LENGTH, `Name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters`)
  .max(DISPLAY_NAME_MAX_LENGTH, `Name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`);

export const commentContentSchema = z
  .string()
  .trim()
  .min(COMMENT_MIN_LENGTH, `Comment must be at least ${COMMENT_MIN_LENGTH} characters`)
  .max(COMMENT_MAX_LENGTH, `Comment must be at most ${COMMENT_MAX_LENGTH} characters`);

/** Адреса обкладинки — лише https (як `@IsMediaUrl()` у DTO постів). */
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`)
  .refine(
    (value) => hasAllowedProtocol(value, MEDIA_URL_PROTOCOLS),
    'Must be an https:// URL',
  );

/**
 * Відео новини (D54) — посилання YouTube у звичних формах (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`), як
 * `@IsYouTubeVideoUrl()` у DTO: перевіряє та сама функція. API збереже його канонічним.
 */
export const youtubeVideoUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`)
  .refine(
    (value) => parseYouTubeVideoId(value) !== null,
    'Paste a YouTube video link: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/… or /embed/…',
  );

/** Поля перекладу поста (форма адмінки). */
export const postTitleSchema = z
  .string()
  .trim()
  .min(POST_TITLE_MIN_LENGTH, `Title must be at least ${POST_TITLE_MIN_LENGTH} characters`)
  .max(POST_TITLE_MAX_LENGTH, `Title must be at most ${POST_TITLE_MAX_LENGTH} characters`);

export const postExcerptSchema = z
  .string()
  .trim()
  .min(POST_EXCERPT_MIN_LENGTH, `Excerpt must be at least ${POST_EXCERPT_MIN_LENGTH} characters`)
  .max(POST_EXCERPT_MAX_LENGTH, `Excerpt must be at most ${POST_EXCERPT_MAX_LENGTH} characters`);

export const postContentSchema = z
  .string()
  .trim()
  .min(POST_CONTENT_MIN_LENGTH, `Content must be at least ${POST_CONTENT_MIN_LENGTH} characters`)
  .max(POST_CONTENT_MAX_LENGTH, `Content must be at most ${POST_CONTENT_MAX_LENGTH} characters`);

/**
 * Опис обкладинки для незрячих і підпис автора фото (D44). Порожні — можна: обов'язкові вони лише
 * для публікації з обкладинкою, і це правило форма перевіряє разом з іншими полями.
 */
export const postCoverImageAltSchema = z
  .string()
  .trim()
  .max(POST_COVER_IMAGE_ALT_MAX_LENGTH, `Alt text must be at most ${POST_COVER_IMAGE_ALT_MAX_LENGTH} characters`);

export const postCoverImageCreditSchema = z
  .string()
  .trim()
  .max(POST_COVER_IMAGE_CREDIT_MAX_LENGTH, `Credit must be at most ${POST_COVER_IMAGE_CREDIT_MAX_LENGTH} characters`);

/** Явний slug новини (D24) — як `@Matches(SLUG_PATTERN)` у DTO API. */
export const postSlugSchema = z
  .string()
  .trim()
  .max(POST_SLUG_MAX_LENGTH, `Slug must be at most ${POST_SLUG_MAX_LENGTH} characters`)
  .regex(SLUG_PATTERN, 'Use lowercase latin letters and digits, words joined by single hyphens');

/** Посилання на джерело новини (D26) — http(s), як `@IsSourceUrl()` у DTO. */
export const sourceUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`)
  .refine(
    (value) => hasAllowedProtocol(value, SOURCE_URL_PROTOCOLS),
    'Must be an http:// or https:// URL',
  );

/** Назва джерела («BBC Sport», D26). Порожня — можна: сайт покаже домен адреси. */
export const postSourceNameSchema = z
  .string()
  .trim()
  .max(POST_SOURCE_NAME_MAX_LENGTH, `Source name must be at most ${POST_SOURCE_NAME_MAX_LENGTH} characters`);

/** Назва тегу однією мовою (D45) — як `@Length(TAG_NAME_*)` у DTO API. */
export const tagNameSchema = z
  .string()
  .trim()
  .min(TAG_NAME_MIN_LENGTH, `Name must be at least ${TAG_NAME_MIN_LENGTH} characters`)
  .max(TAG_NAME_MAX_LENGTH, `Name must be at most ${TAG_NAME_MAX_LENGTH} characters`);

/** Явний slug тегу (D45) — як `@Matches(SLUG_PATTERN)` у `CreateTagDto`. */
export const tagSlugSchema = z
  .string()
  .trim()
  .max(TAG_SLUG_MAX_LENGTH, `Slug must be at most ${TAG_SLUG_MAX_LENGTH} characters`)
  .regex(SLUG_PATTERN, 'Use lowercase latin letters and digits, words joined by single hyphens');

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
    message: "Passwords don't match",
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
      message: 'The English name has no latin letters or digits — type the address',
    });
  });
export type TagFormValues = z.infer<typeof tagFormSchema>;
