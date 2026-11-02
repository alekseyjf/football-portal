import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** Ім'я схеми — у параметрі підключення `options`, тож лише проста назва: `public`, `e2e`. */
const SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Куди насправді підключився клієнт. */
export interface SchemaTarget {
  database: string;
  /** `null` — жодної схеми з `search_path` у БД немає */
  schema: string | null;
}

/**
 * Клієнт Prisma на одну схему — для скриптів поза застосунком (сід, e2e, стенд). Таблиці Prisma адаптер кваліфікує
 * сам, схемою з параметра `PrismaPg` (`"e2e"."Post"`): `search_path` і `?schema=` з рядка підключення для них не
 * діють, і без параметра запити йдуть у `public` (M1.8.3a). Сирий SQL без схеми знаходить таблиці через
 * `search_path` (`options`). Тож обидва — з одного значення; що з'єднання його прийняло, каже `assertSchemaTarget`.
 */
export function createSchemaPrismaClient(
  databaseUrl: string,
  schema: string,
): PrismaClient {
  if (!SCHEMA_NAME_PATTERN.test(schema)) {
    throw new Error(
      `Invalid schema name "${schema}": lowercase latin letters, digits and _ only`,
    );
  }
  const connectionUrl = new URL(databaseUrl);
  connectionUrl.searchParams.set('options', `-c search_path=${schema}`);
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: connectionUrl.toString() },
      { schema },
    ),
  });
}

/**
 * До першого запису: з'єднання — у схемі `expectedSchema`. Інакше виняток — так буває, коли пулер мовчки відкинув
 * `options` (Supabase transaction pooler, :6543): тоді сирий SQL пішов би в `public`.
 */
export async function assertSchemaTarget(
  prisma: PrismaClient,
  expectedSchema: string,
): Promise<SchemaTarget> {
  const [target] = await prisma.$queryRaw<SchemaTarget[]>`
    SELECT current_database() AS database, current_schema() AS schema`;
  if (target.schema !== expectedSchema) {
    throw new Error(
      `Connected to ${describeSchemaTarget(target)}, expected schema "${expectedSchema}" — the schema does not ` +
        'exist, or the connection ignores the search_path option (use a session-mode connection, port 5432)',
    );
  }
  return target;
}

/** Ціль одним рядком — для журналу скрипту. */
export function describeSchemaTarget(target: SchemaTarget): string {
  const schema = target.schema === null ? 'none' : `"${target.schema}"`;
  return `database "${target.database}", schema ${schema}`;
}
