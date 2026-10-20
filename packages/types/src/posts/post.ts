import type { ApiSchemas } from '../api-schemas';

/**
 * `GET /posts` — сторінка стрічки. Переклад кожної новини вже обрав API: запитана мова, без неї —
 * default (`en`); `resolvedLanguage` ≠ запитаній → «переклад недоступний».
 */
export type PaginatedPosts = ApiSchemas['PaginatedPostsDto'];

/** `GET /posts/{number}`. Коментарі — окремо: `GET /comments/post/{postId}`. */
export type PostDetail = ApiSchemas['PostDetailDto'];
