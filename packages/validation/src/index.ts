/**
 * Спільні правила валідації — єдине джерело чисел для API (class-validator DTO)
 * і форм web / admin (zod-схеми у `@football-portal/validation/forms`).
 * Цей вхід без залежностей: API імпортує лише його, zod йому не потрібен.
 */

/** RFC 5321: довша адреса не доставляється. */
export const EMAIL_MAX_LENGTH = 254;

/** Політика для **нового** пароля (реєстрація, згодом — зміна пароля). */
export const PASSWORD_MIN_LENGTH = 8;
/**
 * bcrypt обрізає пароль до 72 **байт** UTF-8 — довший мовчки втратив би хвіст.
 * Межа саме в байтах: кирилиця — 2 байти на літеру, тож 72 символи кирилицею = 144 байти.
 */
export const PASSWORD_MAX_BYTES = 72;
/**
 * Для **введеного** пароля (логін, підтвердження видалення акаунта): без мінімуму —
 * старі акаунти могли зареєструватися за попередньою політикою (6 символів).
 * Максимум — лише захист від величезних тіл (bcrypt сам обрізає до 72 байт).
 */
export const PASSWORD_INPUT_MAX_LENGTH = 256;

/** `UserProfile.displayName` */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Текст коментаря — після trim. */
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 2000;

/** URL медіа поста (`coverImage`, `videoUrl`): лише https. */
export const MEDIA_URL_PROTOCOLS = ['https'];
/** Посилання на джерело новини (`sourceUrl`). */
export const SOURCE_URL_PROTOCOLS = ['http', 'https'];
export const URL_MAX_LENGTH = 2048;

/** Переклад поста — після trim. */
export const POST_TITLE_MIN_LENGTH = 5;
export const POST_TITLE_MAX_LENGTH = 200;
export const POST_EXCERPT_MIN_LENGTH = 10;
export const POST_EXCERPT_MAX_LENGTH = 500;
export const POST_CONTENT_MIN_LENGTH = 20;
export const POST_CONTENT_MAX_LENGTH = 100_000;

/** Скільки тегів / клубів / турнірів можна прив'язати до одного поста. */
export const POST_RELATION_IDS_MAX = 20;

/** Сторінка публічної стрічки (`GET /posts?limit=`). */
export const POSTS_PAGE_LIMIT_MAX = 50;

/**
 * Довжина рядка в байтах UTF-8 — так її рахує bcrypt. `TextEncoder`, а не `encodeURI`:
 * на одиночному surrogate (`"\ud800"` у JSON) `encodeURI` кидає виняток, а тут це 3 байти (U+FFFD).
 */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
