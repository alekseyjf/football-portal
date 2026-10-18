import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parse as parseDotenv } from 'dotenv';
import { Client } from 'pg';

/*
 * E2E живуть в окремій схемі `e2e` тієї самої БД, що й розробка (👤 2026-10-18, D30): справжні дані
 * лежать у `public`, і тести до них не доходять. Схема — константа, а не налаштування: жоден рядок
 * підключення чи змінна середовища не спрямує в `public` ні запити застосунку, ні DROP / TRUNCATE.
 */
export const E2E_SCHEMA = 'e2e';

const API_DIR = join(__dirname, '..', '..');
const API_ENV_FILE = join(API_DIR, '.env');
const MIGRATIONS_DIR = join(API_DIR, 'prisma', 'migrations');

/** Довідник мов, як у `prisma/seed.ts`: без нього пости не створюються (default-мова — `en`). */
const E2E_LANGUAGES = [
  { code: 'en', name: 'English', isDefault: true, sortOrder: 1 },
  { code: 'uk', name: 'Українська', isDefault: false, sortOrder: 2 },
];

export type E2eDatabaseSource = 'E2E_DATABASE_URL' | 'DIRECT_URL';

/**
 * `E2E_DATABASE_URL` (змінна процесу — так у CI з тимчасовим Postgres — або рядок у `apps/api/.env`),
 * інакше `DIRECT_URL` з `.env` (Supabase session pooler, :5432). `DATABASE_URL` (transaction pooler,
 * :6543) не беремо: `search_path` живе в сесії, а там кожна транзакція може потрапити в інше з'єднання.
 * `.env` лише читаємо — у `process.env` тестів він не потрапляє, тож застосунок не отримає з нього
 * ні секретів, ні ключа football-data.
 */
export function resolveE2eDatabaseUrl(): {
  url: string;
  source: E2eDatabaseSource;
} {
  const envFile = readApiEnvFile();
  const explicitUrl = (
    process.env.E2E_DATABASE_URL || envFile.E2E_DATABASE_URL
  )?.trim();
  if (explicitUrl) return { url: explicitUrl, source: 'E2E_DATABASE_URL' };
  const directUrl = envFile.DIRECT_URL?.trim();
  if (directUrl) return { url: directUrl, source: 'DIRECT_URL' };
  throw new Error(
    'E2E: set E2E_DATABASE_URL, or DIRECT_URL (Supabase session pooler, port 5432) in apps/api/.env',
  );
}

function readApiEnvFile(): Record<string, string> {
  try {
    return parseDotenv(readFileSync(API_ENV_FILE));
  } catch (error) {
    // У CI `.env` немає — там задають E2E_DATABASE_URL
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

/** Міграції в порядку Prisma (за назвою теки): `0001_init`, `0002_…`. */
function readMigrationsSql(): { sql: string; count: number } {
  const migrationDirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const sql = migrationDirs
    .map((dir) =>
      readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'),
    )
    .join('\n');
  return { sql, count: migrationDirs.length };
}

/**
 * Перед прогоном: схему `e2e` — з нуля за поточними міграціями. Міграції пишуть таблиці без схеми,
 * а 0004 / 0005 ще й оновлюють рядки (`UPDATE "AuthSession"`) — тож `search_path` ставимо в тій самій
 * транзакції (`SET LOCAL`) і перевіряємо до першої міграції. Увесь скрипт — один запит, одна транзакція
 * на одному з'єднанні (навіть через пулер): схему перебудовано повністю або не змінено нічого.
 */
export async function rebuildE2eSchema(databaseUrl: string): Promise<number> {
  const migrations = readMigrationsSql();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      BEGIN;
      DROP SCHEMA IF EXISTS "${E2E_SCHEMA}" CASCADE;
      CREATE SCHEMA "${E2E_SCHEMA}";
      SET LOCAL search_path TO "${E2E_SCHEMA}";
      DO $$ BEGIN
        IF current_schema() IS DISTINCT FROM '${E2E_SCHEMA}' THEN
          RAISE EXCEPTION 'e2e: search_path resolves to %, expected ${E2E_SCHEMA}', current_schema();
        END IF;
      END $$;
      ${migrations.sql}
      COMMIT;`);
  } finally {
    await client.end();
  }
  return migrations.count;
}

/**
 * Клієнт Prisma на схему `e2e` — замість `PrismaService` (той пише в `public`: адаптер Prisma 7
 * параметр `?schema=` з рядка підключення ігнорує). Запити Prisma адаптер кваліфікує сам
 * (`"e2e"."Post"`); сирий SQL застосунку (`FOR NO KEY UPDATE`) пише таблиці без схеми —
 * їх знаходить `search_path`, заданий при підключенні (`options`).
 */
export function createE2ePrismaClient(databaseUrl: string): PrismaClient {
  const connectionUrl = new URL(databaseUrl);
  connectionUrl.searchParams.set('options', `-c search_path=${E2E_SCHEMA}`);
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: connectionUrl.toString() },
      { schema: E2E_SCHEMA },
    ),
  });
}

/** Пулер, що мовчки відкинув `options`, віддав би сирому SQL таблиці `public` — тоді тести не стартують. */
export async function assertE2eSearchPath(prisma: PrismaClient): Promise<void> {
  const [{ schema }] = await prisma.$queryRaw<{ schema: string | null }[]>`
    SELECT current_schema() AS schema`;
  if (schema !== E2E_SCHEMA) {
    throw new Error(
      `E2E: raw SQL resolves to schema "${schema}", expected "${E2E_SCHEMA}" — the connection ignores the search_path option (use a session-mode connection)`,
    );
  }
}

/**
 * На початку кожного файлу тестів: порожні таблиці схеми `e2e` + довідник мов. Імена — з каталогу
 * лише цієї схеми й кваліфіковані явно, тож TRUNCATE не залежить від `search_path`.
 */
export async function resetE2eData(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = ${E2E_SCHEMA}`;
  if (tables.length === 0) {
    throw new Error(
      `E2E: schema "${E2E_SCHEMA}" has no tables — run e2e via test/jest-e2e.json (globalSetup rebuilds it)`,
    );
  }
  const qualifiedTables = tables
    .map(({ tablename }) => `"${E2E_SCHEMA}"."${tablename}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`,
  );
  await prisma.language.createMany({ data: E2E_LANGUAGES });
}
