import type { ApiSchemas } from '../api-schemas';

/** Тіло `POST /auth/login` і `/auth/login/admin`. */
export type LoginRequest = ApiSchemas['LoginDto'];

/** Тіло `POST /auth/register`. */
export type RegisterRequest = ApiSchemas['RegisterDto'];

/** Відповідь `register`, `login`, `login/admin`: створений або залогінений користувач. */
export type AuthUserResponse = ApiSchemas['AuthUserResponseDto'];

/** `GET /auth/me`: `user: null` — гість. */
export type CurrentUserResponse = ApiSchemas['CurrentUserResponseDto'];
