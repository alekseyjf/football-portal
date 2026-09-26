/** Глобальний префікс роутів (`main.ts`); від нього залежить `path` refresh-cookie. */
export const API_GLOBAL_PREFIX = 'api/v1';

/**
 * Ліміт JSON-тіла (дефолт Express — 100 KB). Найбільший валідний пост — переклади до
 * `POST_CONTENT_MAX_LENGTH` (100 000) символів кожен: EN ≈ 100 KB + UA кирилицею ≈ 200 KB
 * (2 байти на літеру) — у 100 KB не влазив навіть сам UA-переклад (413).
 */
export const JSON_BODY_LIMIT = '1mb';
