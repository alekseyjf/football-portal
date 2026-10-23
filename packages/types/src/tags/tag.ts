import type { ApiSchemas } from '../api-schemas';

/**
 * Тег в адмінці (D45): `GET /tags/admin/all`, відповідь `POST` / `PUT /tags` — назви всіма мовами й кількість новин
 * будь-якого статусу, крім видалених.
 */
export type AdminTag = ApiSchemas['AdminTagDto'];

/** Тіло `POST /tags`; без `slug` — адреса з англійської назви. Після створення адреса не змінюється. */
export type CreateTagRequest = ApiSchemas['CreateTagDto'];

/** Тіло `PUT /tags/{id}`: назви — upsert за мовою; мов, яких немає в масиві, зміна не торкається. */
export type UpdateTagRequest = ApiSchemas['UpdateTagDto'];

/** Назва тегу однією мовою в тілі `POST` / `PUT /tags`. */
export type TagTranslationRequest = ApiSchemas['TagTranslationDto'];

/** `DELETE /tags/{id}`: тег видалено назавжди й прибрано з усіх новин. */
export type DeletedTag = ApiSchemas['DeletedTagDto'];
