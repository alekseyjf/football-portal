// Другий крок `pnpm gen:api-types` (D28): openapi.json (пише API) → src/generated/openapi.ts.
// openapi-typescript — лише типи, без рантайм-коду; клієнт лишається свій (`lib/api/http.ts`).
// Результат не в git (.gitignore): його генерують `pnpm install` (prepare) і `pnpm gen:api-types`.
import { mkdirSync, writeFileSync } from 'node:fs';
import openapiTS, { astToString } from 'openapi-typescript';

const documentUrl = new URL('../openapi.json', import.meta.url);
const outputUrl = new URL('../src/generated/openapi.ts', import.meta.url);

const HEADER = `/**
 * Згенеровано з packages/types/openapi.json (\`pnpm gen:api-types\`) — не редагувати вручну.
 * Імена типів для web і admin — у файлах сутностей пакета (\`src/posts/post.ts\` …), не тут.
 */

`;

const ast = await openapiTS(documentUrl);
const source = HEADER + astToString(ast);
// На свіжому clone теки `generated/` ще немає
mkdirSync(new URL('.', outputUrl), { recursive: true });
writeFileSync(outputUrl, source);
console.log(`API types: ${outputUrl.pathname}`);
