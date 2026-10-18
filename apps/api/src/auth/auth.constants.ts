/** Життя access-JWT; cookie `access_token` живе стільки ж. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Ковзне вікно refresh-сесії: кожна ротація дає нові 7 днів (P2-6). */
export const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Абсолютний ліміт життя сесії від логіну (2f): ротація не продовжує її далі,
 * навіть якщо користувач активний щодня. Далі — лише новий логін.
 */
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Скільки після ротації старий refresh-токен вважається «гонкою вкладок», а не крадіжкою (P2-5):
 * у цьому вікні за наявності живого наступника відповідаємо 409, сім'ю не відкликаємо.
 */
export const REFRESH_SUPERSEDED_GRACE_MS = 30 * 1000;

/** Алгоритм підпису access-JWT; `JwtStrategy` інших не приймає. Секрет — `JWT_SECRET` (схема env). */
export const ACCESS_TOKEN_ALGORITHM = 'HS256';
