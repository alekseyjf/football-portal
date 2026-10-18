/**
 * Типи API для web і admin (D28). Джерело — OpenAPI-документ API: `openapi.json` →
 * `src/generated/openapi.ts` (`pnpm gen:api-types`, руками не редагувати). Тут — лише імена схем,
 * по файлу на сутність, у теках за модулями API (`posts/admin-post.ts` ↔ `apps/api/src/posts`);
 * форму відповіді змінює API, а не цей пакет.
 */

// Спільне
export * from './common/message-response';

// Користувачі й сесія
export * from './users/user-account';
export * from './users/public-author';
export * from './auth/session';

// Новини
export * from './languages/content-language';
export * from './posts/post';
export * from './posts/admin-post';

// Коментарі й реакції
export * from './comments/comment';
export * from './likes/like';

// Футбол
export * from './football/league';
export * from './football/club';
export * from './football/match';
export * from './football/fixtures';
export * from './football/standing';
export * from './football/league-dashboard';
export * from './football/live-touch';
export * from './football/sync';
