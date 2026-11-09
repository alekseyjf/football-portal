import { API_BASE_PATH } from '@football-portal/validation';

/**
 * Глобальний префікс роутів (`main.ts`); від нього залежить `path` refresh-cookie. Той самий шлях проксіюють web і
 * адмінка (`API_BASE_PATH`, D59) — тож cookie з цим `path` працює й на їхньому домені.
 */
export const API_GLOBAL_PREFIX = API_BASE_PATH.slice(1);

/**
 * Ліміт JSON-тіла (дефолт Express — 100 KB). Найбільший валідний пост — переклади до
 * `POST_CONTENT_MAX_LENGTH` (100 000) символів кожен: EN ≈ 100 KB + UK кирилицею ≈ 200 KB
 * (2 байти на літеру) — у 100 KB не влазив навіть сам UK-переклад (413).
 */
export const JSON_BODY_LIMIT = '1mb';
