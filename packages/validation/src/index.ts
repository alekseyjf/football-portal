/**
 * Спільні правила валідації — єдине джерело чисел для API (class-validator DTO)
 * і форм web / admin (zod-схеми у `@football-portal/validation/forms`).
 * Цей вхід без залежностей: API імпортує лише його, zod йому не потрібен.
 */

/** RFC 5321: довша адреса не доставляється. */
export const EMAIL_MAX_LENGTH = 254;

/** Політика для **нового** пароля (реєстрація, згодом — зміна пароля). */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt обрізає пароль до 72 байт — довший мовчки втратив би хвіст. */
export const PASSWORD_MAX_LENGTH = 72;
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
