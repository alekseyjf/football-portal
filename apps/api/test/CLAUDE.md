# E2E API — правила

Підвантажується лише при роботі з `apps/api/test/`. Чому так — [D30](../../../docs/decisions/D30-testing-and-local-env.md), механіка — коментарі в `support/`.

- Тести живуть в окремій схемі `e2e` тієї самої БД, що й розробка; `public` — справжні дані.
- Застосунок — лише `createE2eApp()` (`support/e2e-app.ts`), не вручну з `AppModule`: адаптер Prisma 7 ігнорує `?schema=`, і справжній `PrismaService` писав би в `public`. `{ unavailableDatabaseUrl }` — для тестів «БД недоступна».
- Кожен файл починає з `resetE2eData(e2e.prisma)`; файли йдуть по одному (`maxWorkers: 1`) і не залежать один від одного.
- Схему не чіпати через `prisma migrate` / `db push` — її перебудовує `globalSetup` з `prisma/migrations` на кожен прогін.
- Користувачі — `createUser` / `loginAs` (`support/e2e-auth.ts`): ≤ 5 реєстрацій на файл (ліміт з IP). Ключа football-data немає — синк відповідає 503.
- Підключення — `E2E_DATABASE_URL` або `DIRECT_URL` (session pooler); transaction pooler не підходить (`search_path`).
- Файли — `test/<модуль>/*.e2e-spec.ts`; запуск модуля з кореня — `pnpm test:e2e -- <модуль>`.
- Контракт ([D28](../../../docs/decisions/D28-openapi-contract.md)): відповідь ендпоінта — `expectMatchesContract(response, 'get', '/posts/{number}')` (`support/openapi-contract.ts`): статус описаний у `packages/types/openapi.json`, тіло — за схемою, без незадокументованих полів. Змінив DTO чи роут — спершу `pnpm gen:api-types`.
- Env тест-застосунку — `createE2eApp({ envOverrides })` (`COMMENT_COOLDOWN_MS: '0'`, прод-режим); турнір з матчами й таблицею — `seedFootballLeague` (`support/e2e-football.ts`): синк без ключа не працює.
- supertest: `request(server)` слухає порт лише до кінця свого запиту — запит створювати там, де його `await`-ять, а не масивом наперед (інакше `ECONNREFUSED`).
- Гонка — детерміновано: блокування тримає окрема транзакція (`e2e.prisma.$transaction`), тест чекає, доки запит застрягне на ньому (`pg_stat_activity`, `wait_event_type = 'Lock'`), і лише тоді відпускає (`finally`); CHECK з `constraints.sql` — записом в обхід API. Приклад — `tags/tags.e2e-spec.ts`.
