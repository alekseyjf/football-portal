import type { ApiSchemas } from '../api-schemas';

/** Поточний користувач — з email; лише у відповідях `/auth/*` (`login`, `register`, `me`). */
export type UserAccount = ApiSchemas['UserAccountDto'];
