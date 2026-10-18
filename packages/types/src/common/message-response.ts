import type { ApiSchemas } from '../api-schemas';

/** Відповідь-підтвердження без даних: `logout`, `refresh`, `DELETE /users/me`. */
export type MessageResponse = ApiSchemas['MessageResponseDto'];
