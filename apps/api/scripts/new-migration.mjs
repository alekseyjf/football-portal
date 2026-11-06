// Нова міграція — SQL з різниці `schema.prisma` проти схеми, з якої почалась гілка; БД не потрібна (D58).
// На спільній dev / test БД `prisma migrate dev` (і з `--create-only`) заборонено: він працює з цією БД і на
// розбіжності пропонує скинути схему. `prisma migrate diff` між двома файлами схеми до БД не звертається —
// так створено 0006–0012.
//
// `pnpm db:migration:new <назва>` з кореня; назва — snake_case → `prisma/migrations/<NNNN>_<назва>/migration.sql`.
// База — `git merge-base HEAD origin/master`; інша — `--base <ref>` (друга міграція в тій самій гілці: першу
// закомітити, потім `--base HEAD`).
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));
/** Шляхи від кореня репозиторію — так їх розуміє `git show <ref>:<шлях>`. */
const SCHEMA_PATH = 'apps/api/prisma/schema.prisma';
const MIGRATIONS_PATH = 'apps/api/prisma/migrations';
const DEFAULT_BASE_BRANCH = 'origin/master';
const MIGRATION_NAME_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;
const MIGRATION_DIR_PATTERN = /^(\d{4})_/;
/** `prisma migrate diff --exit-code`: 0 — різниці немає, 2 — є (1 — помилка). */
const DIFF_EXIT_EMPTY = 0;
const DIFF_EXIT_NOT_EMPTY = 2;

function parseArgs(args) {
  const baseIndex = args.indexOf('--base');
  const hasBase = baseIndex !== -1;
  const baseRef = hasBase ? args[baseIndex + 1] : null;
  if (hasBase && !baseRef) throw new Error('Після --base потрібен git ref');
  const names = hasBase
    ? args.filter((_, i) => i !== baseIndex && i !== baseIndex + 1)
    : args;
  if (names.length !== 1 || !MIGRATION_NAME_PATTERN.test(names[0])) {
    throw new Error(
      'Використання: pnpm db:migration:new <назва_snake_case> [--base <ref>]',
    );
  }
  return { name: names[0], baseRef };
}

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function resolveBaseCommit(repoRoot, baseRef) {
  const args = baseRef
    ? ['rev-parse', '--verify', `${baseRef}^{commit}`]
    : ['merge-base', 'HEAD', DEFAULT_BASE_BRANCH];
  return git(repoRoot, args).trim();
}

function migrationDirsInWorkTree(repoRoot) {
  return readdirSync(join(repoRoot, MIGRATIONS_PATH)).filter((name) =>
    MIGRATION_DIR_PATTERN.test(name),
  );
}

function migrationDirsInCommit(repoRoot, commit) {
  return git(repoRoot, ['ls-tree', '--name-only', `${commit}:${MIGRATIONS_PATH}`])
    .split('\n')
    .filter((name) => MIGRATION_DIR_PATTERN.test(name));
}

/**
 * Різниця схем має бути рівно новою міграцією: міграція, якої немає в базі, повторилась би в SQL, а міграція бази,
 * якої немає тут, означає, що база — не та, з якої почалась гілка.
 */
function assertMigrationsMatchBase(workTreeDirs, baseDirs, baseLabel) {
  const notInBase = workTreeDirs.filter((name) => !baseDirs.includes(name));
  if (notInBase.length > 0) {
    throw new Error(
      `Міграцій ${notInBase.join(', ')} немає в ${baseLabel} — різниця схем повторила б їх. ` +
        'Закоміть їх і запусти з --base HEAD.',
    );
  }
  const missingHere = baseDirs.filter((name) => !workTreeDirs.includes(name));
  if (missingHere.length > 0) {
    throw new Error(
      `У ${baseLabel} є міграції, яких тут немає (${missingHere.join(', ')}) — спершу онови гілку.`,
    );
  }
}

function nextMigrationNumber(dirs) {
  const numbers = dirs.map((name) => Number(MIGRATION_DIR_PATTERN.exec(name)[1]));
  return String(Math.max(0, ...numbers) + 1).padStart(4, '0');
}

/** Повертає код `--exit-code`; SQL — у `outputPath`. */
function diffSchemas(baseSchemaPath, outputPath) {
  const prismaCli = createRequire(join(API_DIR, 'package.json')).resolve(
    'prisma/build/index.js',
  );
  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'diff',
      '--from-schema',
      baseSchemaPath,
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
      '--exit-code',
      '--output',
      outputPath,
    ],
    // stdout — лише «Loaded Prisma config…»; помилки Prisma пише в stderr
    { cwd: API_DIR, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return result.status;
}

function printNextSteps(migrationFile) {
  console.log(`Створено ${migrationFile}. Далі:
  1. Прочитати SQL: DROP + ADD замість RENAME, втрата даних, блокування таблиць (backend Rule 16).
  2. CHECK чи частковий індекс, яких Prisma не виражає, — дописати сюди і в prisma/sql/constraints.sql.
  3. Expand → contract: міграція не має ламати код, що зараз працює на тесті (D58).
  4. pnpm test:e2e — схема e2e перебудується з нею.
  5. На спільну БД — лише після воріт rules/process.md («Міграція на dev-БД»): pnpm db:migrate.`);
}

function createMigration({ name, baseRef }) {
  const repoRoot = git(API_DIR, ['rev-parse', '--show-toplevel']).trim();
  const baseCommit = resolveBaseCommit(repoRoot, baseRef);
  const baseLabel = `${baseRef ?? `merge-base з ${DEFAULT_BASE_BRANCH}`} (${baseCommit.slice(0, 7)})`;
  const workTreeDirs = migrationDirsInWorkTree(repoRoot);
  assertMigrationsMatchBase(
    workTreeDirs,
    migrationDirsInCommit(repoRoot, baseCommit),
    baseLabel,
  );

  const workDir = mkdtempSync(join(tmpdir(), 'new-migration-'));
  try {
    const baseSchemaPath = join(workDir, 'base.prisma');
    writeFileSync(baseSchemaPath, git(repoRoot, ['show', `${baseCommit}:${SCHEMA_PATH}`]));
    const sqlPath = join(workDir, 'migration.sql');
    const diffExitCode = diffSchemas(baseSchemaPath, sqlPath);
    if (diffExitCode === DIFF_EXIT_EMPTY) {
      throw new Error(`schema.prisma не змінилась відносно ${baseLabel} — міграції немає.`);
    }
    if (diffExitCode !== DIFF_EXIT_NOT_EMPTY) {
      throw new Error('prisma migrate diff завершився з помилкою (див. вище).');
    }
    const migrationDir = `${nextMigrationNumber(workTreeDirs)}_${name}`;
    mkdirSync(join(repoRoot, MIGRATIONS_PATH, migrationDir));
    const migrationFile = `${MIGRATIONS_PATH}/${migrationDir}/migration.sql`;
    // Міграції — LF (виняток code-style.md): контрольна сума застосованої лежить у `_prisma_migrations`
    writeFileSync(
      join(repoRoot, migrationFile),
      readFileSync(sqlPath, 'utf8').replace(/\r\n/g, '\n'),
    );
    console.log(`База: ${baseLabel}.`);
    printNextSteps(migrationFile);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  createMigration(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
