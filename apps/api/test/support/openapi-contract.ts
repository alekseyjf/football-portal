import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { recordCheckedOperation } from './contract-coverage';

/*
 * Контракт API (D28): відповідь ендпоінта має бути такою, як у packages/types/openapi.json — з нього
 * генеруються типи web і admin. Перевіряємо згенерований документ (`pnpm gen:api-types`, у git його немає),
 * а не той, що віддає тест-застосунок: ts-jest збирає без CLI-плагіна Swagger, і схем DTO в його документі
 * немає. Змінив DTO чи роут — спершу `pnpm gen:api-types`. Перевірена 2xx-відповідь іде в журнал
 * покриття (`contract-coverage.ts`).
 */

const OPENAPI_DOCUMENT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'types',
  'openapi.json',
);

/** Схеми компонентів — під цим `$id`; `$ref` документа переписуємо на нього. */
const COMPONENTS_SCHEMA_ID = 'openapi-components';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

type SchemaObject = Record<string, unknown>;

interface ResponseObject {
  content?: Record<string, { schema?: SchemaObject }>;
}

interface OpenApiDocument {
  paths: Record<
    string,
    Partial<
      Record<
        HttpMethod,
        {
          security?: Record<string, string[]>[];
          responses: Record<string, ResponseObject>;
        }
      >
    >
  >;
  components: { schemas: Record<string, SchemaObject> };
}

/** Відповідь supertest — лише те, що перевіряємо. */
interface ContractResponse {
  status: number;
  body: unknown;
}

function isSchemaObject(value: unknown): value is SchemaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapSchemas(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map((item) => toStrictJsonSchema(item as SchemaObject))
    : value;
}

/**
 * Схема OpenAPI 3.0 → JSON Schema для ajv. `nullable` → `null` теж допустимий (для `allOf` з `$ref` —
 * через `anyOf`). В об'єкті з `properties` — `additionalProperties: false`: поле, якого немає
 * в документі, — порушення контракту (згенерований тип про нього не знає, а воно може бути витоком).
 */
function toStrictJsonSchema(schema: SchemaObject): SchemaObject {
  const { nullable, ...rest } = schema;
  const converted: SchemaObject = { ...rest };
  // `example` — анотація OpenAPI, не JSON Schema: ajv у strict-режимі на ній падає
  delete converted.example;
  if (typeof rest.$ref === 'string') {
    converted.$ref = rest.$ref.replace(
      '#/components/schemas/',
      `${COMPONENTS_SCHEMA_ID}#/definitions/`,
    );
  }
  if (isSchemaObject(rest.properties)) {
    converted.properties = Object.fromEntries(
      Object.entries(rest.properties).map(([name, propertySchema]) => [
        name,
        toStrictJsonSchema(propertySchema as SchemaObject),
      ]),
    );
    converted.additionalProperties ??= false;
  }
  if (isSchemaObject(rest.items)) {
    converted.items = toStrictJsonSchema(rest.items);
  }
  if (isSchemaObject(rest.additionalProperties)) {
    converted.additionalProperties = toStrictJsonSchema(
      rest.additionalProperties,
    );
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    if (rest[keyword]) converted[keyword] = mapSchemas(rest[keyword]);
  }
  if (nullable !== true) return converted;

  const isComposed = ['allOf', 'anyOf', 'oneOf', '$ref'].some(
    (keyword) => keyword in converted,
  );
  if (typeof converted.type === 'string' && !isComposed) {
    return {
      ...converted,
      type: [converted.type, 'null'],
      ...(Array.isArray(converted.enum)
        ? { enum: [...(converted.enum as unknown[]), null] }
        : {}),
    };
  }
  return { anyOf: [converted, { type: 'null' }] };
}

function loadOpenApiDocument(): OpenApiDocument {
  return JSON.parse(
    readFileSync(OPENAPI_DOCUMENT_PATH, 'utf8'),
  ) as OpenApiDocument;
}

function createSchemaValidator(document: OpenApiDocument): Ajv {
  // Строго: помилка в перетворенні схеми має впасти, а не пропустити перевірку
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema({
    $id: COMPONENTS_SCHEMA_ID,
    definitions: Object.fromEntries(
      Object.entries(document.components.schemas).map(([name, schema]) => [
        name,
        toStrictJsonSchema(schema),
      ]),
    ),
  });
  return ajv;
}

let cachedDocument: OpenApiDocument | null = null;
let cachedAjv: Ajv | null = null;
const validatorByResponse = new Map<string, ValidateFunction>();

export function openApiDocument(): OpenApiDocument {
  cachedDocument ??= loadOpenApiDocument();
  return cachedDocument;
}

function jsonSchemaOf(response: ResponseObject | undefined) {
  return response?.content?.['application/json']?.schema;
}

/**
 * Відповідь відповідає документу: статус описано в операції, тіло — за його схемою
 * (помилки — за `default`, `ApiErrorDto`), без незадокументованих полів.
 * `pathTemplate` — як у документі: `/posts/{number}`.
 */
export function expectMatchesContract(
  response: ContractResponse,
  method: HttpMethod,
  pathTemplate: string,
): void {
  const operation = openApiDocument().paths[pathTemplate]?.[method];
  const operationName = `${method.toUpperCase()} ${pathTemplate}`;
  if (!operation) {
    throw new Error(`${operationName} is missing in openapi.json`);
  }
  const status = String(response.status);
  expect({
    operationName,
    isStatusDocumented: status in operation.responses,
  }).toEqual({ operationName, isStatusDocumented: true });

  const schema =
    jsonSchemaOf(operation.responses[status]) ??
    (response.status >= 400
      ? jsonSchemaOf(operation.responses.default)
      : undefined);
  if (!schema) {
    throw new Error(
      `${operationName} ${status}: no JSON schema in openapi.json`,
    );
  }

  const validatorKey = `${operationName} ${status}`;
  let validate = validatorByResponse.get(validatorKey);
  if (!validate) {
    cachedAjv ??= createSchemaValidator(openApiDocument());
    validate = cachedAjv.compile(toStrictJsonSchema(schema));
    validatorByResponse.set(validatorKey, validate);
  }
  validate(response.body);
  expect({ operationName, status, errors: validate.errors ?? [] }).toEqual({
    operationName,
    status,
    errors: [],
  });
  // Покриття — лише успіх: 401 / 403 перевіряє access-control, 400 — Definition of Done ендпоінта
  if (response.status >= 200 && response.status < 300) {
    recordCheckedOperation(method, pathTemplate);
  }
}
