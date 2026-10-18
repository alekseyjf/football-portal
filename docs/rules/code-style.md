# Правила: стиль коду

> Позначки: без позначки — чинне правило; ⭐ — нове або змінене 2026-10-08 (перечитай).

## TypeScript
- `strict: true` у web, admin, пакетах і в API (з M1.3.1, [D29](../decisions/D29-strict-typescript-api.md)).
- Ніяких `any` → `unknown` або явний тип (ESLint API ловить `no-unsafe-*`).
- ⭐ Типи відповідей API у web / admin — **згенеровані** з OpenAPI (`packages/types`), не написані вручну ([D28](../decisions/D28-openapi-contract.md)).
- ⭐ Без кастів, що ховають помилки (`req.user as …`) — для користувача є `@CurrentUser()`.

## Іменування
- Компоненти, класи — `PascalCase`; функції, змінні — `camelCase`; константи — `SCREAMING_SNAKE_CASE`; файли компонентів — `PostCard.tsx`.
- У бізнес-коді й утилітах — мінімум **3 символи** в іменах змінних і параметрів, окрім загальноприйнятих: `id`, `url`, `err` (у дуже вузькому контексті), `tx` (клієнт транзакції Prisma), `i` / `j` (індекси циклу без семантики).
- Назва відображає **роль значення**, а не форму: `matchFromApi`, `encodedCompetitionRef`, `clubIdByExternalTeamId` — а не `map`, `row`, `data`.
- Типи зовнішнього API в мапері — з префіксом провайдера: `Fd*` (football-data.org).
- Сервіси — use case-и з описовими іменами: `createPost`, `syncLeagueStandings` (не `handlePost`, `processData`).

## Розмір і структура
- Компонент < 200 рядків; більше — розбити або винести логіку в хук.
- Repository — лише Prisma і завжди `select`, не `include`.

## ⭐ Коментарі в коді
- Мова — українська (як склалося в проєкті); коментар пояснює **чому**, а не що робить рядок.
- Посилання на рішення — за ID: `(P5-3)`, `(🧭 п. 6)`, `(D24)` — їх видно в `docs/decisions/`. Номери етапів плану в коментарях — лише нові (`M1.9`).

## Кінці рядків (👤 2026-10-17)
- **Усі текстові файли — CRLF**, і код, і `docs/`. Виняток — LF лише там, де файл пише інструмент або CR щось ламає: `pnpm-lock.yaml` (pnpm переписує його в LF при кожній зміні залежностей), `apps/api/prisma/migrations/**` (генерує Prisma; контрольна сума застосованої міграції — у `_prisma_migrations`), `*.sh` (shell не розуміє CR).
- Перевірка — `pnpm lint:eol` (входить у `pnpm lint`), виправлення — `pnpm fix:eol`; список винятків — `scripts/line-endings.mjs`, для редакторів — `.editorconfig`.
- LF з'являється від генераторів: `prisma format` з CLI, нові файли від create-next-app / AI, `pnpm add` (переписує `package.json` застосунку в LF; `pnpm install` CRLF зберігає) — після них `pnpm fix:eol`.
