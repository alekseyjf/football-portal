# D28 — Контракт API: OpenAPI (Swagger) як джерело правди

- **Статус:** ✅ прийнято · 2026-10-08 · 👤 рішення власника (У16, У17) + ⭐ деталі · **виконано в M1.3.4–M1.3.5** (2026-10-18)
- **Етап:** M1.3.4 (Swagger і response DTO), M1.3.5 (типи web / admin з документа)
- **Замінює:** [🧭 п. 8](v5-architecture-review.md) (`satisfies` + `packages/types` → `dist`)

## Контекст
API не імпортує `packages/types` (форма відповіді — `ReturnType<toPublic*>`), web вірить вручну написаним інтерфейсам, константи дубльовано. Кожен новий ендпоінт збільшує ризик тихого розходження API і web.

## Рішення
- 👤 OpenAPI-схема з `@nestjs/swagger` (+ CLI-плагін) — джерело правди контракту. Response DTO — окремі класи (не моделі Prisma); `toPublic*` повертають їхню форму.
- 👤 Типи для web / admin генерує `openapi-typescript` у `packages/types`. ~~Згенерований файл — у git~~ → 👤 2026-10-19: **згенеровані файли в git не зберігаємо** (`.gitignore`) — їх створює `pnpm install` (`prepare`) і `pnpm gen:api-types`.
- ⭐ Схему генерує скрипт без запуску сервера й БД. ~~CI перевіряє `git diff --exit-code`~~ → CI генерує типи з коду сам (`pnpm install`), а розходження ловлять `pnpm typecheck` web / admin і контрактні e2e.
- ⭐ `openapi-typescript`, а не Orval: Orval генерує власні React Query хуки, а в нас уже є свій патерн (`queryOptions` + `lib/api/http.ts`).
- 👤 Swagger UI — локально і на тест-сервері (за паролем сайту), на проді — вимкнений.
- ~~👤 Перехід поступовий: спершу пости й теги (M1.4), решта модулів — коли до них доходимо~~ → 👤 2026-10-18: **одразу всі ендпоінти**, якими користуються web і admin; ручні типи замінено згенерованими, `packages/types` поділено за доменами.

## Як зроблено (M1.3.4–M1.3.5)
- **Схема відповіді = тип, який повертає метод контролера** (`Promise<PostDetailDto>`): CLI-плагін (`nest-cli.json`, `introspectComments`) бере її з TypeScript, тож опис не може розійтися з кодом. Response DTO — по файлу на сутність, `dto/<сутність>-response.dto.ts` (`match-response.dto.ts`, `club-response.dto.ts`; суфікс `.dto.ts` обробляє плагін); `@ApiProperty` — лише там, де плагін не вгадає: іменовані enum-и (`enumName`), формат дати, `oneOf`.
- **Описи — з JSDoc:** перший рядок методу — `summary`, `@remarks` — `description`, `@throws {404} POST_NOT_FOUND — …` — відповідь з кодом помилки. JSDoc полів DTO — опис поля (а в згенерованих типах — JSDoc для IDE); внутрішні нотатки — звичайними `//`.
- **Спільне — одним місцем у `openapi/openapi-document.ts`:** відповідь `default` = `ApiErrorDto` (тіло будь-якої помилки), 400 — кожній операції з тілом чи query-параметрами (глобальний `ValidationPipe`; крім `lang` — його не перевіряють, P3-3). Описи однакового статусу Swagger склеює: `@AdminOnly()` уже дає 403 «не ADMIN», тож `@throws {403}` адмін-роуту називає лише свої коди. Доступ — декоратори `@AuthRequired()` / `@AdminOnly()` / `@AuthOptional()`: guard-и й опис (`security`, 401 / 403) разом, тож не розходяться.
- **Шляхи без префікса** (`/posts`, як в `apiGet('/posts')`), префікс `/api/v1` — у `servers`.
- **Генерація без сервера, БД і `.env`:** `pnpm gen:api-types` = `nest build` (з плагіном) → `node dist/openapi/write-openapi-document.js` (Nest у режимі `preview` — граф модулів без створення провайдерів) → `packages/types/openapi.json` → `openapi-typescript` → `packages/types/src/generated/openapi.ts`. Обидва файли — не в git (👤 2026-10-19): після clone їх створює `pnpm install`, після зміни API — `pnpm gen:api-types`; генерація детермінована (перевірено), ~5 с.
- **Імена типів:** назва схеми без `Dto` (`PostDetailDto` → `PostDetail`); тіло запиту — ще й із `Request` (`CreatePostDto` → `CreatePostRequest`). 👤 Файл — логічна сутність у теці модуля API, як на боці API: `users/user-account.ts`, `auth/session.ts`, `posts/post.ts`, `posts/admin-post.ts`, `football/match.ts`, `football/club.ts` …; один `index.ts` експортує все. Експортується лише те, чим користуються web / admin, решта — у `generated/openapi.ts` (один файл — так його пише `openapi-typescript`).
- **Контрактні e2e** (`test/support/openapi-contract.ts`): реальна відповідь кожного ендпоінта перевіряється проти `openapi.json` — статус описаний, тіло за схемою, **жодного незадокументованого поля** (`additionalProperties: false`: нове поле в `select` без DTO — витік, тест падає).
- ⭐ `@nestjs/swagger` **11.4.7**, а не 12.x — *чому:* 12.x лише для Nest 12 і ESM (як terminus / config у M1.3.2–M1.3.3).

## Наслідки
- Нові ендпоінти не вважаються готовими без опису в Swagger (Definition of Done ендпоінта): response DTO, тип повернення методу, `@throws`, `pnpm gen:api-types`, e2e з `expectMatchesContract`.
- Змінив DTO — `pnpm gen:api-types`; e2e-тест `swagger-ui` падає, якщо набір ендпоінтів у коді й в `openapi.json` різний; у CI типи генеруються з коду, тож застаріти не можуть (M1.10).
- Ціна рішення 👤 2026-10-19: зміну контракту не видно в diff PR — її видно у змінених DTO і в Swagger UI; збірка web / admin потребує кроку генерації (`pnpm install` робить його сам).

## Розглянуті альтернативи
- Ручні типи + `satisfies` (🧭 п. 8) — замінено: не ловить розходжень у web.
- tRPC / GraphQL — відхилено: REST уже є, і в майбутньому можливий мобільний клієнт.
- `@ApiProperty` руками на кожному полі без CLI-плагіна — відхилено: удвічі більше коду, і опис може розійтися з типом поля.
- Генерувати документ запуском сервера (`/api/docs-json`) — відхилено: потрібні БД і секрети; preview-режим Nest дає той самий документ без них.
