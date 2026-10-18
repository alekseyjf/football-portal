import type { ApiSchemas } from '../api-schemas';

/**
 * Автор новини чи коментаря — без email і дат. Видалений акаунт: `isDeleted`, у `name` — «Deleted user»
 * з БД; UI показує локалізований підпис.
 */
export type PublicAuthor = ApiSchemas['PublicAuthorDto'];
