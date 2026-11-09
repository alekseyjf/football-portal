/**
 * Як web і адмінка звертаються до API (M1.11.3, D59): браузер — лише на свій origin (`/api/v1/*` сайту чи адмінки),
 * далі запит пересилає сервер застосунку; SSR — на API напряму. Запит від сервера сайту несе секрет — API без нього
 * відповідає 403 (крім `/health`), — а пересланий з браузера ще й IP клієнта. Цей файл без залежностей від Node: його
 * бере й клієнтський код (`lib/api/http.ts`).
 */

/** Префікс маршрутів API (Nest `setGlobalPrefix`) — і шлях, за яким браузер звертається до API через сайт. */
export const API_BASE_PATH = '/api/v1';

/** API на машині розробника — для `APP_ENV=development` (`next dev`, `next start` локально). */
export const LOCAL_API_ORIGIN = 'http://localhost:4000';

/** Секрет сервера сайту (`API_ORIGIN_SECRET`): з ним API приймає запит. */
export const ORIGIN_SECRET_HEADER = 'x-origin-secret';

/** IP браузера, який визначив сервер сайту (на Vercel — `x-forwarded-for`, який платформа переписує сама). */
export const CLIENT_IP_HEADER = 'x-client-ip';
