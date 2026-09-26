/**
 * Анонімізація видаленого акаунта (D19, розділ 7.5.1).
 * Рядок `User` лишається (FK постів/коментарів — `Restrict`), персональні дані — ні.
 */

/**
 * `.invalid` зарезервований RFC 2606 — справжньої пошти там не буває.
 * Реєстрацію на цей TLD забороняємо: інакше можна заздалегідь зайняти
 * `deleted-<id>@removed.invalid` чужого користувача (id авторів публічні)
 * і зламати йому видалення акаунта на `@unique`.
 *
 * ⚠️ Формат адреси продубльовано в CHECK `User_reserved_email_check`
 * (prisma/sql/constraints.sql): змінюєш тут — потрібна міграція.
 */
const RESERVED_EMAIL_TLD = '.invalid';
const DELETED_ACCOUNT_EMAIL_DOMAIN = 'removed.invalid';

/** Зберігається в профілі; фронт локалізує за `PublicAuthor.isDeleted`. */
export const DELETED_USER_DISPLAY_NAME = 'Deleted user';

/** Ніколи не проходить `bcrypt.compare` (перевірено: `false`, без винятку). */
export const DELETED_ACCOUNT_PASSWORD_HASH = '';

/** Унікальний (як і `userId`) і звільняє справжній email для повторної реєстрації. */
export function deletedAccountEmail(userId: string): string {
  return `deleted-${userId}@${DELETED_ACCOUNT_EMAIL_DOMAIN}`;
}

/** `normalizedEmail` — уже `toLowerCase().trim()`. */
export function isReservedEmail(normalizedEmail: string): boolean {
  return normalizedEmail.endsWith(RESERVED_EMAIL_TLD);
}
