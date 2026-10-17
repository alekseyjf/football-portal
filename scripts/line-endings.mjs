// Кінці рядків у репозиторії: усі текстові файли — CRLF, крім тих, що мусять бути LF (code-style.md).
// `node scripts/line-endings.mjs` — перевірка (падає зі списком файлів), `--fix` — виправити.
// Що текст, а що бінарне, і які кінці рядків у файлі — визначає сам git (`git ls-files --eol`).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/** LF — файли, які пишуть інструменти, і ті, що ламаються від CR. */
const LF_ONLY_PATTERNS = [
  // pnpm переписує lock-файл у LF при кожній зміні залежностей
  /^pnpm-lock\.yaml$/,
  // Генерує Prisma; контрольна сума застосованої міграції лежить у `_prisma_migrations`
  /^apps\/api\/prisma\/migrations\//,
  // Shell не розуміє CR (`bad interpreter: /bin/bash^M`)
  /\.sh$/,
];

const shouldFix = process.argv.includes('--fix');

function listTextFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--eol', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  );
  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const [info, filePath] = entry.split('\t');
      const workTreeEol = info.split(/\s+/)[1].replace('w/', '');
      return { filePath, workTreeEol };
    })
    // Бінарні (`-text`), однорядкові без переносу (`none`) і видалені з диска (``) — пропускаємо
    .filter(({ workTreeEol }) => ['lf', 'crlf', 'mixed'].includes(workTreeEol));
}

const wrongFiles = listTextFiles()
  .map(({ filePath, workTreeEol }) => {
    const expectedEol = LF_ONLY_PATTERNS.some((pattern) => pattern.test(filePath))
      ? 'lf'
      : 'crlf';
    return { filePath, workTreeEol, expectedEol };
  })
  .filter(({ workTreeEol, expectedEol }) => workTreeEol !== expectedEol);

if (wrongFiles.length === 0) {
  console.log('Line endings OK');
  process.exit(0);
}

if (!shouldFix) {
  for (const { filePath, workTreeEol, expectedEol } of wrongFiles) {
    console.error(`${filePath}: ${workTreeEol}, expected ${expectedEol}`);
  }
  console.error(`\n${wrongFiles.length} file(s) with wrong line endings. Fix: pnpm fix:eol`);
  process.exit(1);
}

for (const { filePath, expectedEol } of wrongFiles) {
  const content = readFileSync(filePath, 'utf8');
  writeFileSync(filePath, content.replace(/\r?\n/g, expectedEol === 'crlf' ? '\r\n' : '\n'));
  console.log(`${filePath} → ${expectedEol}`);
}
