# 12Yards — футбольний портал

Футбольний портал для США і світу: **новини** (свої та чужі — з посиланням на джерело), **коментарі** й **лайки**, **ліги, турніри, таблиці й матчі** (дані синхронізуються з football-data.org у власну БД). Production-oriented monorepo: чиста архітектура бекенду й фронтенду, TanStack Query на фронті, безпека (JWT у httpOnly cookies, refresh-сесії в БД).

> **Документація — [`docs/`](docs/README.md):** план і стан проєкту — [`docs/football-plan.md`](docs/football-plan.md), рішення — [`docs/decisions/`](docs/decisions/README.md), правила — [`docs/rules/`](docs/rules/), як влаштовано — [`docs/architecture.md`](docs/architecture.md).

---

## Стек

| Шар | Технології |
|-----|------------|
| **Web** | Next.js 16 (App Router), React 19, Tailwind 4, next-intl (`en` / `uk`), React Hook Form, Zod, Zustand, **TanStack Query** |
| **Admin** | Next.js 16 (порт **3001**), TanStack Query |
| **API** | NestJS 11, Prisma 7, PostgreSQL (Supabase), JWT (httpOnly cookies), class-validator, Helmet, throttler, axios, **@nestjs/schedule** |
| **Monorepo** | pnpm workspaces, Turborepo |
| **Спільне** | `packages/types`, `packages/validation`, `packages/config` |

---

## Структура репозиторію

```
football-portal/
├── apps/
│   ├── web/          # Публічний сайт (:3000)
│   ├── admin/        # Адмін-панель (:3001)
│   └── api/          # REST API (:4000), Prisma, NestJS
├── packages/
│   ├── types/        # Спільні типи API
│   ├── validation/   # Спільні межі валідації (DTO API + zod-схеми форм)
│   ├── config/       # Спільний tsconfig
│   └── ui/           # Спільний UI web і admin (з'явиться в M1.5)
├── docs/             # План, рішення, правила, архітектура, архів
├── CLAUDE.md         # Контекст для AI-асистента
└── README.md         # Цей файл
```

---

## Вимоги

- **Node.js** — див. [`.nvmrc`](./.nvmrc) та `engines` у кореневому `package.json`.
- **pnpm** — через [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`.

---

## Швидкий старт

```bash
# з кореня репозиторію
corepack enable
pnpm install          # після install виконається prisma generate (prepare / скрипти workspace)
```

Створи **`apps/api/.env`** (не коміть у git): мінімум `DATABASE_URL`, `DIRECT_URL` (для міграцій через Supabase — див. `apps/api/prisma.config.ts`), `JWT_SECRET`, `EMAIL_HASH_SECRET`, `CORS_ORIGINS`. Повний перелік змінних — `CLAUDE.md` («Environment Variables») і [`docs/architecture.md`](docs/architecture.md); `.env.example` з'явиться в M1.3.

Міграції БД (з кореня або з `apps/api`):

```bash
pnpm --filter @football-portal/api exec prisma migrate deploy
# або під час розробки
pnpm --filter @football-portal/api exec prisma migrate dev
```

Якщо TypeScript «не бачить» `PrismaClient`:

```bash
pnpm run db:generate
```

Запуск усіх застосунків у dev:

```bash
pnpm dev
```

Окремо API:

```bash
pnpm --filter @football-portal/api dev
```

Football-дані: після seed у БД 9 турнірів; перший синк — кнопка **«Синк»** в адмінці (потрібен `FOOTBALL_API_KEY`) — див. [`docs/architecture.md`](docs/architecture.md), «Типовий потік „перший запуск“».

---

## Порти та префікс API

| Застосунок | Порт |
|------------|------|
| Web | 3000 |
| Admin | 3001 |
| API | 4000 |

Усі маршрути Nest мають префікс **`/api/v1`**. Фронти звертаються до `NEXT_PUBLIC_API_URL`, наприклад `http://localhost:4000/api/v1`.
