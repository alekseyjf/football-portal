/**
 * Страж frontend Rule 15 (M1.8.3): індексацію вирішує працюючий сервер, а не збірка. Одна збірка без `SITE_INDEXING`,
 * потім `next start` з `SITE_INDEXING=true` і без неї: `robots.txt`, `/sitemap.xml` і `X-Robots-Tag` мають іти за
 * змінною старту. Зламається, якщо маршрут sitemap чи `robots.ts` знову пререндериться при `next build` (без
 * `await connection()`).
 *
 * API — фейковий (`GET /posts/sitemap` — один місяць): його адресу сервер читає під час роботи (`API_ORIGIN`, D59).
 * Збірка — в окрему теку `.next/runtime-env-check` (`NEXT_DIST_DIR`), а не в `.next` розробника. Збірка з іншою текою
 * дописує її шляхи типів у `tsconfig.json` і `next-env.d.ts` — страж повертає обидва файли як були. Запуск:
 * `pnpm test:runtime-env`.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const NEXT_BIN = fileURLToPath(
  new URL('../node_modules/.bin/next', import.meta.url),
);
const DIST_DIR = '.next/runtime-env-check';
const SITEMAP_MONTH = '2026-10';
/** Файли, які `next build` переписує під свою теку збірки. */
const FILES_REWRITTEN_BY_BUILD = ['tsconfig.json', 'next-env.d.ts'];
const START_TIMEOUT_MS = 30_000;

/**
 * Змінні, яких бути не повинно: порожнє значення в оточенні `@next/env` не перекриває з `.env.local`, а схема web
 * вважає його відсутнім.
 */
const UNSET = {
  SITE_INDEXING: '',
  REVALIDATE_SECRET: '',
  REVALIDATE_SECRET_PREVIOUS: '',
  API_ORIGIN_SECRET: '',
  BASIC_AUTH_USER: '',
  BASIC_AUTH_PASSWORD: '',
};

const failures = [];

function check(description, isOk) {
  console.log(`${isOk ? '✓' : '✗'} ${description}`);
  if (!isOk) failures.push(description);
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

async function startFakeApi() {
  const server = createServer((req, res) => {
    if (req.url === '/api/v1/posts/sitemap') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          months: [
            {
              month: SITEMAP_MONTH,
              postCount: 1,
              lastModifiedAt: '2026-10-30T12:00:00.000Z',
            },
          ],
        }),
      );
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'NOT_FOUND' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

/** Вміст файлів до збірки; `null` — файла не було. */
async function snapshotFiles(names) {
  return Promise.all(
    names.map(async (name) => {
      const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
      const content = await readFile(path).catch(() => null);
      return { path, content };
    }),
  );
}

async function restoreFiles(snapshot) {
  for (const { path, content } of snapshot) {
    if (content === null) await rm(path, { force: true });
    else await writeFile(path, content);
  }
}

/** Процес до кінця; ненульовий код — помилка з його виведенням. */
async function run(args, env) {
  const child = spawn(NEXT_BIN, args, {
    cwd: WEB_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`next ${args[0]} failed:\n${output}`);
}

async function waitUntilServing(origin) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${origin}/robots.txt`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`next start did not answer within ${START_TIMEOUT_MS} ms`);
}

async function withServer(env, verify) {
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const server = spawn(NEXT_BIN, ['start', '-p', String(port)], {
    cwd: WEB_DIR,
    env: { ...env, SITE_URL: origin },
    stdio: 'ignore',
  });
  try {
    await waitUntilServing(origin);
    await verify(origin);
  } finally {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
}

async function readSite(origin) {
  const robots = await fetch(`${origin}/robots.txt`);
  const sitemap = await fetch(`${origin}/sitemap.xml`);
  const home = await fetch(`${origin}/`, { redirect: 'manual' });
  return {
    robotsText: await robots.text(),
    sitemapStatus: sitemap.status,
    sitemapXml: await sitemap.text(),
    robotsTag: home.headers.get('x-robots-tag'),
  };
}

async function main() {
  const fakeApi = await startFakeApi();
  const env = {
    ...process.env,
    ...UNSET,
    NEXT_DIST_DIR: DIST_DIR,
    // `next start` — NODE_ENV=production: середовище обов'язкове; машина розробника — без пароля й секрету API
    APP_ENV: 'development',
    API_ORIGIN: `http://127.0.0.1:${fakeApi.address().port}`,
  };
  try {
    console.log(`next build → ${DIST_DIR} (без SITE_INDEXING)…`);
    const snapshot = await snapshotFiles(FILES_REWRITTEN_BY_BUILD);
    try {
      await run(['build'], env);
    } finally {
      await restoreFiles(snapshot);
    }

    await withServer({ ...env, SITE_INDEXING: 'true' }, async (origin) => {
      const site = await readSite(origin);
      console.log('\nnext start, SITE_INDEXING=true:');
      check(
        'robots.txt — Allow: / і Sitemap з адресою сайту',
        site.robotsText.includes('Allow: /') &&
          !site.robotsText.includes('Disallow') &&
          site.robotsText.includes(`Sitemap: ${origin}/sitemap.xml`),
      );
      check(
        `/sitemap.xml — 200 з місяцем ${SITEMAP_MONTH} з API`,
        site.sitemapStatus === 200 &&
          site.sitemapXml.includes(
            `<loc>${origin}/sitemaps/posts-${SITEMAP_MONTH}.xml</loc>`,
          ),
      );
      check('без X-Robots-Tag', site.robotsTag === null);
    });

    await withServer(env, async (origin) => {
      const site = await readSite(origin);
      console.log('\nnext start без SITE_INDEXING:');
      check(
        'robots.txt — Disallow: / і без Sitemap',
        site.robotsText.includes('Disallow: /') &&
          !site.robotsText.includes('Sitemap:'),
      );
      check('/sitemap.xml — 404', site.sitemapStatus === 404);
      check(
        'X-Robots-Tag: noindex, nofollow',
        site.robotsTag === 'noindex, nofollow',
      );
    });
  } finally {
    fakeApi.close();
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log('\nOK: індексацію вирішує сервер, а не збірка');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
