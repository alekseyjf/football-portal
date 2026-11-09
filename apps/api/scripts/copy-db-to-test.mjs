// Копія БД розробки в тестову (D61): схема `public` з даними → порожня `public` окремого проєкту Supabase тест-сервера.
// `pnpm db:copy-to-test` з кореня. Джерело — DIRECT_URL з apps/api/.env (БД розробки, session pooler :5432). Ціль —
// TEST_DIRECT_URL у середовищі команди, а без неї — прихований запит (краще: адреса тестової БД не лишається ні у
// файлах, ні в історії shell). Потрібні pg_dump і psql ≥ 17: `brew install libpq` — скрипт знайде їх і поза PATH.
//
// Кроки: запобіжники (ціль — не джерело, `public` цілі порожня, версії) → pg_dump `public` у тимчасову теку (без даних
// сесій, пауз і HMAC пошт розробки) → розширення, від яких залежить `public` джерела, — у ціль → psql: дамп і чистка
// однією транзакцією → рядки «джерело | ціль» і `prisma migrate status` по цілі. Пароль — лише в змінних середовища
// pg_dump / psql / Prisma, не в аргументах (їх видно в `ps`); у виводі адреси — з `***` замість пароля.
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_ENV_FILE = join(API_DIR, '.env');
/** Supabase — Postgres 17; pg_dump, молодший за сервер джерела, дамп не зробить. */
const MIN_PG_TOOLS_MAJOR = 17;
/** `brew install libpq` ставить утиліти «keg-only» — поза PATH (Apple Silicon, Intel). */
const HOMEBREW_LIBPQ_DIRS = ['/opt/homebrew/opt/libpq/bin', '/usr/local/opt/libpq/bin'];
const CONNECT_TIMEOUT_SECONDS = '15';
/**
 * Дані, яких копія не бере (D61): сесії й паузи коментарів — розробки, а HMAC пошт видалених акаунтів порахований
 * EMAIL_HASH_SECRET розробки й на тесті (свій секрет) ні з чим не збігся б. Таблиці в цілі є — порожні.
 */
const SKIPPED_DATA_TABLES = ['AuthSession', 'RateLimitEvent', 'BlockedEmail'];
/** Незакритий запуск синку тримав би лок турніру на тесті до 10 хв (`STALE`) — закриваємо його одразу. */
const COPIED_RUN_MESSAGE = 'COPIED: запуск з БД розробки, у тестовій не виконувався (D61)';
const CLOSE_COPIED_RUNS_SQL = `UPDATE public."SyncRun"
  SET status = 'FAILED', "finishedAt" = now(), "errorMessage" = '${COPIED_RUN_MESSAGE}'
  WHERE status = 'RUNNING';`;
/** pg_dump зі `--schema=public` пише й створення самої схеми, а в цілі `public` уже є — psql зупинився б на ньому. */
const CREATE_PUBLIC_SCHEMA = 'CREATE SCHEMA public;';
/** Рядок дампу `COPY public."Post" (…) FROM stdin;` — далі по рядку на запис до `\.`. */
const COPY_START_PATTERN = /^COPY public\.("(?:[^"]|"")+"|[a-z_][a-z0-9_$]*) .* FROM stdin;$/;
const COPY_END = '\\.';
const CTRL_C = String.fromCharCode(3);
const ERASE_KEYS = [String.fromCharCode(8), String.fromCharCode(127)];
const LINE_END_KEYS = ['\r', '\n'];

// ── Адреси ──

/** Адреса PostgreSQL → частини для libpq (`PG*`) і для виводу. Query-параметри, крім `sslmode`, libpq не потрібні. */
function parseConnection(rawUrl, label) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    // Помилка URL несе саму адресу разом із паролем — не показуємо її
    throw new Error(`${label}: це не адреса PostgreSQL (postgresql://…)`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${label}: потрібна адреса postgresql://…`);
  }
  return {
    raw: rawUrl,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)) || 'postgres',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sslMode: url.searchParams.get('sslmode'),
  };
}

function maskedUrl({ user, host, port, database }) {
  const shownHost = host.includes(':') ? `[${host}]` : host;
  return `postgresql://${user}:***@${shownHost}:${port}/${database}`;
}

/**
 * Та сама БД — з користувачем: пулер Supabase має один хост і порт на всі проєкти регіону, а проєкт видно лише з
 * імені `postgres.<ref>`. Інша адреса тієї ж БД (інший порт, пряме з'єднання) сюди не потрапить — її зупинить
 * перевірка порожньої `public`.
 */
function isSameDatabase(source, target) {
  return ['host', 'port', 'database', 'user'].every(
    (part) => source[part].toLowerCase() === target[part].toLowerCase(),
  );
}

/** Пароль — лише в середовищі утиліти: аргументи процесу видно в `ps`. */
function libpqEnv(connection) {
  return {
    ...process.env,
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.user,
    PGPASSWORD: connection.password,
    PGCONNECT_TIMEOUT: CONNECT_TIMEOUT_SECONDS,
    PGAPPNAME: 'copy-db-to-test',
    ...(connection.sslMode ? { PGSSLMODE: connection.sslMode } : {}),
  };
}

function readSourceUrl() {
  if (!existsSync(SOURCE_ENV_FILE)) {
    throw new Error('Немає apps/api/.env: джерело копії — DIRECT_URL з нього (БД розробки).');
  }
  const { DIRECT_URL: directUrl } = parseEnv(readFileSync(SOURCE_ENV_FILE, 'utf8'));
  if (!directUrl) {
    throw new Error('У apps/api/.env немає DIRECT_URL — адреси БД розробки (session pooler, :5432), з якої копіюємо.');
  }
  return directUrl;
}

async function readTargetUrl() {
  const fromEnv = process.env.TEST_DIRECT_URL?.trim();
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new Error(
      'Немає TEST_DIRECT_URL, а ввести адресу ніде (не термінал). Запусти в терміналі: pnpm db:copy-to-test',
    );
  }
  const answer = await askHidden('Адреса тестової БД — Session pooler, :5432 (введення не видно): ');
  if (!answer) throw new Error('Адресу тестової БД не введено.');
  return answer;
}

/** Ввід без луни: термінал у raw mode, символи збираємо самі (вставка з буфера приходить одним шматком). */
function askHidden(prompt) {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    let answer = '';
    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(answer.trim());
    };
    const onData = (chunk) => {
      for (const key of chunk) {
        if (LINE_END_KEYS.includes(key)) return finish();
        if (key === CTRL_C) return finish(new Error('Скасовано.'));
        answer = ERASE_KEYS.includes(key) ? answer.slice(0, -1) : answer + key;
      }
    };
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.resume();
  });
}

// ── pg_dump і psql ──

/** Утиліта без shell. Помилка — з її stderr: libpq пароля не друкує. */
function runTool(command, args, { env = process.env, stdio = ['ignore', 'pipe', 'pipe'] } = {}) {
  const result = spawnSync(command, args, { env, stdio, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${basename(command)} перервано (${result.signal}).`);
  if (result.status !== 0) {
    const details = result.stderr ? `:\n${result.stderr.trim()}` : ' (див. вище).';
    throw new Error(`${basename(command)} завершився з кодом ${result.status}${details}`);
  }
  return result.stdout ?? '';
}

/** pg_dump і psql — з однієї теки: psql має розуміти те, що пише pg_dump (`\restrict` — з 17.6 / 18). */
function findPgTools() {
  const searchDirs = [...(process.env.PATH ?? '').split(delimiter), ...HOMEBREW_LIBPQ_DIRS];
  const toolsDir = searchDirs.find(
    (dir) => dir && existsSync(join(dir, 'pg_dump')) && existsSync(join(dir, 'psql')),
  );
  if (!toolsDir) {
    throw new Error('Не знайдено pg_dump і psql. Постав їх: brew install libpq (скрипт знайде їх і поза PATH).');
  }
  const tools = { pgDump: join(toolsDir, 'pg_dump'), psql: join(toolsDir, 'psql') };
  // `pg_dump (PostgreSQL) 18.6`
  const versionLine = runTool(tools.pgDump, ['--version']).trim();
  const [, version = '?', majorText] = /\(PostgreSQL\) ((\d+)\S*)/.exec(versionLine) ?? [];
  const major = Number(majorText);
  if (!(major >= MIN_PG_TOOLS_MAJOR)) {
    throw new Error(
      `${versionLine} (${toolsDir}) — потрібні pg_dump і psql ≥ ${MIN_PG_TOOLS_MAJOR}: ` +
        'brew install libpq (або brew upgrade libpq).',
    );
  }
  console.log(`pg_dump і psql ${version}: ${toolsDir}`);
  return { ...tools, major };
}

/** Запит через psql: `-X` — без ~/.psqlrc, `-At` — рядки `a|b` без заголовків. */
function queryRows(tools, connection, sql) {
  const output = runTool(tools.psql, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    env: libpqEnv(connection),
  });
  return output.split('\n').filter(Boolean).map((line) => line.split('|'));
}

function quoteIdent(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Рядки кожної таблиці `public` — одним запитом. */
function countRows(tools, connection, tables) {
  const sql = tables
    .map((table) => `SELECT ${quoteLiteral(table)}, count(*) FROM public.${quoteIdent(table)}`)
    .join(' UNION ALL ');
  return new Map(queryRows(tools, connection, sql).map(([table, count]) => [table, Number(count)]));
}

// ── Запобіжники ──

/** Копія — лише в порожню `public`: повторний запуск чи не та БД (з даними) зупиняються тут, до дампу. */
function inspectTarget(tools, target) {
  const [[major, relations, enums]] = queryRows(
    tools,
    target,
    `SELECT current_setting('server_version_num')::int / 10000,
       (SELECT count(*) FROM pg_class
         WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p', 'v', 'm', 'S')),
       (SELECT count(*) FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')`,
  );
  if (Number(relations) > 0 || Number(enums) > 0) {
    throw new Error(
      `У public цілі вже є об'єкти (таблиці й послідовності — ${relations}, enum-типи — ${enums}). ` +
        'Копія — лише в порожню ціль: це повторний запуск або не та БД.',
    );
  }
  return { major: Number(major) };
}

/**
 * Розширення, від яких залежать об'єкти `public` (типи колонок, функції в DEFAULT, оператори індексів), і ті,
 * що встановлені в саму `public`.
 */
const PUBLIC_EXTENSIONS_SQL = `
WITH public_objects AS (
  SELECT 'pg_class'::regclass AS classid, c.oid AS objid FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_attrdef'::regclass, d.oid FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
    WHERE c.relnamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_constraint'::regclass, co.oid FROM pg_constraint co
    WHERE co.connamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_type'::regclass, t.oid FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_proc'::regclass, p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_trigger'::regclass, tg.oid FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace
  UNION ALL SELECT 'pg_rewrite'::regclass, r.oid FROM pg_rewrite r JOIN pg_class c ON c.oid = r.ev_class
    WHERE c.relnamespace = 'public'::regnamespace
)
SELECT DISTINCT e.extname, e.extnamespace::regnamespace::text
FROM public_objects o
JOIN pg_depend d ON d.classid = o.classid AND d.objid = o.objid
JOIN pg_depend member ON member.classid = d.refclassid AND member.objid = d.refobjid
  AND member.refclassid = 'pg_extension'::regclass AND member.deptype = 'e'
JOIN pg_extension e ON e.oid = member.refobjid
UNION
SELECT e.extname, e.extnamespace::regnamespace::text FROM pg_extension e WHERE e.extnamespace = 'public'::regnamespace`;

/** Версія сервера, розширення `public` і скільки рядків у таблицях, дані яких не копіюємо (для звіту). */
function inspectSource(tools, source) {
  const [[major]] = queryRows(tools, source, "SELECT current_setting('server_version_num')::int / 10000");
  const extensions = queryRows(tools, source, PUBLIC_EXTENSIONS_SQL).map(([name, schema]) => ({ name, schema }));
  return { major: Number(major), extensions, skippedRows: countRows(tools, source, SKIPPED_DATA_TABLES) };
}

function assertCompatibleVersions({ toolsMajor, sourceMajor, targetMajor }) {
  if (toolsMajor < sourceMajor) {
    throw new Error(
      `pg_dump ${toolsMajor} не прочитає сервер джерела (Postgres ${sourceMajor}): brew upgrade libpq.`,
    );
  }
  if (targetMajor < sourceMajor) {
    throw new Error(
      `Ціль — Postgres ${targetMajor}, джерело — ${sourceMajor}: дамп новішої версії в старішу не відновлюємо.`,
    );
  }
}

// ── Дамп і відновлення ──

function dumpPublicSchema(tools, source, dumpPath) {
  // У дампі — дані користувачів: файл лише для власника (тека mkdtemp — теж 0700)
  writeFileSync(dumpPath, '', { mode: 0o600 });
  runTool(
    tools.pgDump,
    [
      '--schema=public',
      '--no-owner',
      '--no-privileges',
      ...SKIPPED_DATA_TABLES.map((table) => `--exclude-table-data=public.${quoteIdent(table)}`),
      `--file=${dumpPath}`,
    ],
    { env: libpqEnv(source), stdio: ['ignore', 'inherit', 'inherit'] },
  );
}

/**
 * Дамп → файл для psql без `CREATE SCHEMA public;`; заразом — рядки кожної таблиці в дампі: pg_dump читає один
 * знімок БД, тож це точна кількість рядків джерела, з якою звіряємо ціль.
 */
async function prepareRestoreFile(dumpPath, restorePath) {
  const dumpedRows = new Map();
  const output = createWriteStream(restorePath, { mode: 0o600 });
  let copyTable = null;
  for await (const line of createInterface({ input: createReadStream(dumpPath, 'utf8'), crlfDelay: Infinity })) {
    if (line === CREATE_PUBLIC_SCHEMA) continue;
    if (copyTable !== null) {
      if (line === COPY_END) copyTable = null;
      else dumpedRows.set(copyTable, dumpedRows.get(copyTable) + 1);
    } else {
      const copyStart = COPY_START_PATTERN.exec(line);
      if (copyStart) {
        copyTable = copyStart[1].replace(/^"|"$/g, '').replaceAll('""', '"');
        dumpedRows.set(copyTable, 0);
      }
    }
    if (!output.write(`${line}\n`)) await once(output, 'drain');
  }
  output.end();
  await once(output, 'finish');
  return dumpedRows;
}

/** До відновлення: розширення в тих самих схемах, що в джерелі, — інакше `extensions.uuid_generate_v4()` не знайти. */
function enableExtensions(tools, target, extensions) {
  if (extensions.length === 0) return;
  const statements = extensions.flatMap(({ name, schema }) => [
    // Системні схеми (`pg_catalog`) є завжди, а створювати `pg_*` Postgres не дає
    ...(schema.startsWith('pg_') ? [] : [`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)};`]),
    `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(name)} WITH SCHEMA ${quoteIdent(schema)};`,
  ]);
  queryRows(tools, target, statements.join('\n'));
  const installedSchemas = new Map(
    queryRows(tools, target, 'SELECT extname, extnamespace::regnamespace::text FROM pg_extension'),
  );
  const misplaced = extensions.filter(({ name, schema }) => installedSchemas.get(name) !== schema);
  if (misplaced.length > 0) {
    const list = misplaced.map(
      ({ name, schema }) => `${name} (у джерелі — ${schema}, у цілі — ${installedSchemas.get(name)})`,
    );
    throw new Error(`Розширення в цілі — в іншій схемі, ніж у джерелі: ${list.join(', ')}.`);
  }
  console.log(`Розширення в цілі: ${extensions.map(({ name, schema }) => `${schema}.${name}`).join(', ')}`);
}

/** Дамп і чистка — одна транзакція: впало будь-що — ціль лишається порожньою, і запуск можна повторити. */
function restoreIntoTarget(tools, target, restorePath) {
  runTool(
    tools.psql,
    ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', restorePath, '-c', CLOSE_COPIED_RUNS_SQL],
    { env: libpqEnv(target), stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

// ── Перевірка ──

function compareRowCounts(tools, target, { dumpedRows, skippedRows }) {
  const tables = [...dumpedRows.keys(), ...skippedRows.keys()].sort();
  const targetRows = countRows(tools, target, tables);
  const [[closedRuns]] = queryRows(
    tools,
    target,
    `SELECT count(*) FROM public."SyncRun" WHERE "errorMessage" = ${quoteLiteral(COPIED_RUN_MESSAGE)}`,
  );
  const rows = tables.map((table) => {
    const isSkipped = skippedRows.has(table);
    const sourceCount = isSkipped ? skippedRows.get(table) : dumpedRows.get(table);
    const targetCount = targetRows.get(table);
    const isMismatch = isSkipped ? targetCount !== 0 : targetCount !== sourceCount;
    const notes = [
      isSkipped ? 'дані не копіюються (D61)' : '',
      table === 'SyncRun' && Number(closedRuns) > 0 ? `RUNNING → FAILED: ${closedRuns}` : '',
      isMismatch ? '⚠️ не збігається' : '',
    ];
    return { table, sourceCount, targetCount, isMismatch, note: notes.filter(Boolean).join('; ') };
  });
  printRowCounts(rows);
  return rows.filter((row) => row.isMismatch).map((row) => row.table);
}

function printRowCounts(rows) {
  const tableWidth = Math.max('Таблиця'.length, ...rows.map((row) => row.table.length));
  const countWidth = 9;
  console.log(`\n${'Таблиця'.padEnd(tableWidth)}  ${'Джерело'.padStart(countWidth)}  ${'Ціль'.padStart(countWidth)}`);
  for (const row of rows) {
    const counts = `${String(row.sourceCount).padStart(countWidth)}  ${String(row.targetCount).padStart(countWidth)}`;
    console.log(`${row.table.padEnd(tableWidth)}  ${counts}  ${row.note}`.trimEnd());
  }
}

/** Таблиця `_prisma_migrations` приїхала з дампом — ціль має бути на рівні міграцій репозиторію. */
function checkMigrationStatus(target) {
  const prismaCli = createRequire(join(API_DIR, 'package.json')).resolve('prisma/build/index.js');
  console.log('\nprisma migrate status (ціль):');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'status'], {
    cwd: API_DIR,
    // Обидві — ціль: dotenv у prisma.config.ts наявних змінних не перезаписує, тож БД розробки з .env тут не діє
    env: { ...process.env, DIRECT_URL: target.raw, DATABASE_URL: target.raw },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error('prisma migrate status: ціль не на рівні міграцій репозиторію (див. вище).');
  }
}

function printNextSteps() {
  console.log(`
Копію зроблено. Далі — у тестовому проєкті Supabase (план M1.11, «Порядок», крок 2):
  1. Змінити пароль адміна: у копії він той самий, що в розробці.
  2. Data API вимкнено? Integrations → Data API → Enable Data API — off (D61).
  3. Новини для демо — в адмінці тест-сервера: копія разова, далі БД розробки й тестова живуть окремо.`);
}

// ── Запуск ──

async function copyDatabaseToTest() {
  const source = parseConnection(readSourceUrl(), 'DIRECT_URL (apps/api/.env)');
  const target = parseConnection(await readTargetUrl(), 'Адреса тестової БД');
  console.log(`Джерело — БД розробки: ${maskedUrl(source)}`);
  console.log(`Ціль — тестова БД:     ${maskedUrl(target)}`);
  if (isSameDatabase(source, target)) {
    throw new Error('Ціль — та сама БД, що й джерело. Потрібна адреса тестового проєкту Supabase.');
  }
  const tools = findPgTools();
  const targetState = inspectTarget(tools, target);
  const sourceState = inspectSource(tools, source);
  assertCompatibleVersions({ toolsMajor: tools.major, sourceMajor: sourceState.major, targetMajor: targetState.major });

  const workDir = mkdtempSync(join(tmpdir(), 'copy-db-to-test-'));
  const removeWorkDir = () => rmSync(workDir, { recursive: true, force: true });
  // Ctrl+C посеред дампу: файл з даними користувачів не лишається в тимчасовій теці
  const onInterrupt = () => {
    removeWorkDir();
    process.exit(130);
  };
  process.once('SIGINT', onInterrupt);
  try {
    const dumpPath = join(workDir, 'public.sql');
    const restorePath = join(workDir, 'restore.sql');
    dumpPublicSchema(tools, source, dumpPath);
    const dumpedRows = await prepareRestoreFile(dumpPath, restorePath);
    enableExtensions(tools, target, sourceState.extensions);
    restoreIntoTarget(tools, target, restorePath);
    const mismatches = compareRowCounts(tools, target, { dumpedRows, skippedRows: sourceState.skippedRows });
    if (mismatches.length > 0) {
      throw new Error(`Кількість рядків не збігається: ${mismatches.join(', ')}.`);
    }
    checkMigrationStatus(target);
  } finally {
    process.off('SIGINT', onInterrupt);
    removeWorkDir();
  }
  printNextSteps();
}

try {
  await copyDatabaseToTest();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
