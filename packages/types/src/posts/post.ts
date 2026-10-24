import type { ApiSchemas } from '../api-schemas';

/**
 * `GET /posts` — сторінка стрічки. Переклад кожної новини вже обрав API: запитана мова, без неї —
 * default (`en`); `resolvedLanguage` ≠ запитаній → «переклад недоступний».
 */
export type PaginatedPosts = ApiSchemas['PaginatedPostsDto'];

/** Новина в стрічці (`GET /posts`) — картка: обкладинка, заголовок, анонс, теги й турніри. */
export type PostSummary = ApiSchemas['PostSummaryDto'];

/** Турнір, до якого прив'язана новина, — у стрічці й у новині. */
export type PostCompetition = ApiSchemas['PostCompetitionDto'];

/** `GET /posts/{number}`. Коментарі — окремо: `GET /comments/post/{postId}`. */
export type PostDetail = ApiSchemas['PostDetailDto'];
