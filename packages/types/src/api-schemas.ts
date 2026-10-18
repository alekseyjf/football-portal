import type { components } from './generated/openapi';

/**
 * Схеми OpenAPI-документа API (`components.schemas`) — джерело всіх типів пакета (D28). Ім'я для web /
 * admin — назва схеми без `Dto` (`PostDetailDto` → `PostDetail`), тіло запиту — з `Request`
 * (`CreatePostDto` → `CreatePostRequest`); файл — сутність у теці модуля API (`football/match.ts`).
 */
export type ApiSchemas = components['schemas'];
