import {
  appendFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
 * Покриття контракту (M1.4.9): у повному прогоні e2e кожна операція openapi.json має хоча б одну
 * 2xx-відповідь, перевірену `expectMatchesContract`; 401 / 403 перевіряє access-control, 400 —
 * Definition of Done ендпоінта. Файл тестів не бачить стану інших (свій реєстр модулів, з кількома
 * воркерами — ще й свій процес), тож перевірені операції йдуть у журнал: тимчасова тека прогону,
 * файл на воркер. Журнал з документом зводить globalTeardown.
 */

/** Теку створює globalSetup; файли тестів отримують змінну разом з env процесу Jest. */
const JOURNAL_DIR_ENV = 'E2E_CONTRACT_JOURNAL_DIR';

/** Ключі Path Item, що є операціями (поруч бувають `parameters`, `summary`). */
const OPERATION_KEYS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

/**
 * Операції, 2xx яких e2e не відтворює, — з причиною. Зайвий запис (2xx уже перевірено або операції
 * немає в документі) — теж помилка: список не застаріває непомітно.
 */
const OPERATIONS_WITHOUT_SUCCESS_E2E: ReadonlyMap<string, string> = new Map([
  [
    'POST /football/sync',
    '202 — лише з ключем football-data: у e2e ключа немає, а з ним синк пішов би до провайдера',
  ],
]);

function operationName(method: string, pathTemplate: string): string {
  return `${method.toUpperCase()} ${pathTemplate}`;
}

function journalDir(): string {
  const dir = process.env[JOURNAL_DIR_ENV];
  if (!dir) {
    throw new Error(
      `${JOURNAL_DIR_ENV} is not set: run e2e with test/jest-e2e.json (its globalSetup creates the journal)`,
    );
  }
  return dir;
}

/** globalSetup: порожня тека журналу на цей прогін. */
export function startContractJournal(): void {
  process.env[JOURNAL_DIR_ENV] = mkdtempSync(join(tmpdir(), 'e2e-contract-'));
}

/** `expectMatchesContract`: 2xx-відповідь операції пройшла перевірку. */
export function recordCheckedOperation(
  method: string,
  pathTemplate: string,
): void {
  const workerId = process.env.JEST_WORKER_ID ?? '1';
  appendFileSync(
    join(journalDir(), `worker-${workerId}.log`),
    `${operationName(method, pathTemplate)}\n`,
  );
}

/** globalTeardown: тека журналу більше не потрібна (і після часткового прогону). */
export function removeContractJournal(): void {
  rmSync(journalDir(), { recursive: true, force: true });
}

function readCheckedOperations(): Set<string> {
  const dir = journalDir();
  return new Set(
    readdirSync(dir).flatMap((file) =>
      readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean),
    ),
  );
}

/** Операції документа: `GET /posts/{number}`. */
function documentedOperations(paths: Record<string, object>): string[] {
  return Object.entries(paths).flatMap(([pathTemplate, pathItem]) =>
    Object.keys(pathItem)
      .filter((key) => OPERATION_KEYS.has(key))
      .map((method) => operationName(method, pathTemplate)),
  );
}

/** globalTeardown, повний прогін: операції без перевіреної 2xx-відповіді й застарілі винятки — помилка. */
export function assertContractCoverage(paths: Record<string, object>): void {
  const documented = documentedOperations(paths);
  const checked = readCheckedOperations();
  const uncovered = documented.filter(
    (operation) =>
      !checked.has(operation) && !OPERATIONS_WITHOUT_SUCCESS_E2E.has(operation),
  );
  const staleExemptions = [...OPERATIONS_WITHOUT_SUCCESS_E2E.keys()].filter(
    (operation) => checked.has(operation) || !documented.includes(operation),
  );
  if (uncovered.length === 0 && staleExemptions.length === 0) return;

  const report = [
    'E2E contract coverage: every openapi.json operation needs a 2xx response checked by expectMatchesContract.',
  ];
  if (uncovered.length > 0) {
    report.push(
      'No checked 2xx response (add the success case, Definition of Done):',
      ...uncovered.map((operation) => `  ${operation}`),
      // globalTeardown не бачить результатів тестів, а частину прогонів — і в конфігу Jest
      'A failed test, it.only, --bail or --testPathIgnorePatterns also leaves checks unrun: fix it or rerun the full suite.',
    );
  }
  if (staleExemptions.length > 0) {
    report.push(
      'Stale OPERATIONS_WITHOUT_SUCCESS_E2E entries (2xx is checked now, or the operation is gone):',
      ...staleExemptions.map((operation) => `  ${operation}`),
    );
  }
  throw new Error(report.join('\n'));
}
