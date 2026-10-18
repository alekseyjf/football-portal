import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type OperationObject,
  type ResponseObject,
} from '@nestjs/swagger';
import { API_GLOBAL_PREFIX } from '../app.constants';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookies';
import { ApiErrorDto } from '../common/dto/api-error-response.dto';
import type { AppEnv } from '../config/env.schema';

/** Swagger UI; JSON-документ — поруч, `/api/docs-json`. */
const SWAGGER_UI_PATH = 'api/docs';

const API_TITLE = '12Yards API';

const API_DESCRIPTION = [
  'Контракт API: з цього документа генеруються типи web і admin (`pnpm gen:api-types`).',
  'Сесія — httpOnly cookies: `POST /auth/login` ставить їх і для Swagger UI (той самий origin).',
  'Помилка — `ApiErrorDto`: код у `message`; коди кожного ендпоінта — в описі його відповідей.',
].join('\n\n');

const VALIDATION_ERROR_RESPONSE: ResponseObject = {
  description:
    'Невалідні параметри чи тіло: у `message` — масив повідомлень валідації',
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

/** Query-параметри, які не перевіряються: невідома мова → default-мова, а не 400 (P3-3). */
const UNVALIDATED_QUERY_PARAMETERS: ReadonlySet<string> = new Set(['lang']);

function acceptsInput(operation: OperationObject): boolean {
  return (
    operation.requestBody !== undefined ||
    (operation.parameters ?? []).some(
      (parameter) =>
        'in' in parameter &&
        parameter.in === 'query' &&
        !UNVALIDATED_QUERY_PARAMETERS.has(parameter.name),
    )
  );
}

/**
 * Глобальний `ValidationPipe` (`app.setup.ts`) відповідає 400 кожній операції з тілом чи query-параметрами —
 * описуємо це одним місцем, а не `@throws {400}` на кожному роуті. Опис роуту з власними кодами 400 лишається.
 */
function withValidationErrorResponses(document: OpenAPIObject): OpenAPIObject {
  const paths = Object.fromEntries(
    Object.entries(document.paths).map(([path, pathItem]) => {
      const operations = HTTP_METHODS.flatMap((method) => {
        const operation = pathItem[method];
        if (
          !operation ||
          operation.responses['400'] ||
          !acceptsInput(operation)
        ) {
          return [];
        }
        const responses = {
          ...operation.responses,
          400: VALIDATION_ERROR_RESPONSE,
        };
        return [[method, { ...operation, responses }] as const];
      });
      return [path, { ...pathItem, ...Object.fromEntries(operations) }];
    }),
  );
  return { ...document, paths };
}

/**
 * OpenAPI-документ (D28) — один і для Swagger UI, і для `pnpm gen:api-types`. Шляхи — без глобального
 * префікса (`/posts`, як в `apiGet('/posts')` web і admin), префікс — у `servers`. Схеми відповідей
 * бере CLI-плагін Swagger з типів, які повертають методи контролерів, — тож лише зі збірки `nest`.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(API_DESCRIPTION)
    .setVersion('1')
    .addServer(`/${API_GLOBAL_PREFIX}`)
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .addGlobalResponse({
      status: 'default',
      description: 'Помилка',
      type: ApiErrorDto,
    })
    .build();
  return withValidationErrorResponses(
    SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true }),
  );
}

/**
 * Swagger UI — локально й у e2e; на проді вимкнено (👤 У17). Тест-сервер (за паролем) — M1.11.
 * Документ будується при першому відкритті, а не на старті API.
 */
export function setupSwaggerUi(app: INestApplication, env: AppEnv): void {
  if (env.NODE_ENV === 'production') return;
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => createOpenApiDocument(app), {
    raw: ['json'],
    customSiteTitle: API_TITLE,
  });
}
