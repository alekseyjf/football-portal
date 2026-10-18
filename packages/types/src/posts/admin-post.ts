import type { ApiSchemas } from '../api-schemas';

/** Новина в адмінці: `GET /posts/admin/all`, відповідь `POST` / `PUT /posts`. */
export type AdminPost = ApiSchemas['AdminPostDto'];

/** Тіло `POST /posts`; без `status` — чернетка. */
export type CreatePostRequest = ApiSchemas['CreatePostDto'];

/** Переклад у тілі `POST` / `PUT /posts`. */
export type PostTranslationRequest = ApiSchemas['PostTranslationDto'];
