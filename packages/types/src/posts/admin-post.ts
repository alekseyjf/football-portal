import type { ApiSchemas } from '../api-schemas';

/** Новина в адмінці: рядок списку `GET /posts/admin/all`, відповідь `POST` / `PUT /posts`. */
export type AdminPost = ApiSchemas['AdminPostDto'];

/** `GET /posts/admin/all?page=&limit=&status=&search=` — сторінка списку, нові першими. */
export type PaginatedAdminPosts = ApiSchemas['PaginatedAdminPostsDto'];

/**
 * `GET /posts/admin/{id}` — новина для форми редагування, будь-якого статусу: переклади з текстом, медіа,
 * джерело, теги / турніри / клуби чипами (D47).
 */
export type AdminPostDetail = ApiSchemas['AdminPostDetailDto'];

/** Тіло `POST /posts`; без `status` — чернетка. */
export type CreatePostRequest = ApiSchemas['CreatePostDto'];

/**
 * Тіло `PUT /posts/{id}`: не передане поле не змінюється, `null` — прибрати; переклади — upsert за мовою,
 * передані `tagIds` / `clubIds` / `competitionIds` замінюють зв'язки.
 */
export type UpdatePostRequest = ApiSchemas['UpdatePostDto'];

/** `DELETE /posts/{id}` — soft delete: новина зникає з сайту й адмінки. */
export type DeletedPost = ApiSchemas['DeletedPostDto'];

/** Переклад у тілі `POST` / `PUT /posts`. */
export type PostTranslationRequest = ApiSchemas['PostTranslationDto'];
