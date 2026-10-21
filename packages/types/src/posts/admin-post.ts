import type { ApiSchemas } from '../api-schemas';

/** Новина в адмінці: рядок списку `GET /posts/admin/all`, відповідь `POST` / `PUT /posts`. */
export type AdminPost = ApiSchemas['AdminPostDto'];

/** `GET /posts/admin/all?page=&limit=&status=&search=` — сторінка списку, нові першими. */
export type PaginatedAdminPosts = ApiSchemas['PaginatedAdminPostsDto'];

/** Тіло `POST /posts`; без `status` — чернетка. */
export type CreatePostRequest = ApiSchemas['CreatePostDto'];

/** Переклад у тілі `POST` / `PUT /posts`. */
export type PostTranslationRequest = ApiSchemas['PostTranslationDto'];
