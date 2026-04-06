# Football Portal

Футбольний портал: **новини**, **коментарі**, згодом — **ліги, клуби, матчі та таблиці** (EPL, Serie A тощо). Проєкт зібраний як **production-oriented monorepo** для портфоліо: акцент на чистій архітектурі бекенду та безпеці.

---

## Стек

| Шар | Технології |
|-----|------------|
| **Web** | Next.js 16 (App Router), React 19, Tailwind, React Hook Form, Zod, Zustand |
| **Admin** | Next.js 16 (окремий застосунок, порт 3001) |
| **API** | NestJS 11, Prisma 7, PostgreSQL, JWT (httpOnly cookies), class-validator |
| **Monorepo** | pnpm workspaces, Turborepo |
| **Спільне** | `packages/types`, `packages/config` |

---

## Структура репозиторію

```
football-portal/
├── apps/
│   ├── web/          # Публічний сайт (за замовчуванням :3000)
│   ├── admin/        # Адмін-панель (:3001)
│   └── api/          # REST API (:4000), Prisma, NestJS
├── packages/
│   ├── types/        # Спільні TypeScript-типи
│   └── config/       # ESLint / Prettier / tsconfig base
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Вимоги

- **Node.js** — див. [`.nvmrc`](./.nvmrc) та `engines` у кореневому `package.json` (наприклад, `nvm use` / `fnm use`).
- **pnpm** — версія з поля `packageManager` у корені (рекомендовано через [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

---

## Швидкий старт

```bash
# з кореня репозиторію
corepack enable
pnpm install          # після install виконається prisma generate (prepare / скрипти workspace)
```

Створи **`apps/api/.env`** (не коміть у git): мінімум `DATABASE_URL`; для Supabase з pooler зазвичай ще **`DIRECT_URL`** для міграцій — як у `prisma.config.ts`.

Якщо після клону TypeScript «не бачить» `PrismaClient`:

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

---

## Порти за замовчуванням

| Застосунок | Порт |
|------------|------|
| Web | 3000 |
| Admin | 3001 |
| API | 4000 |

Префікс API: **`/api/v1`** (див. Nest `main.ts`). Для фронту налаштуй базовий URL у `apps/web` / `apps/admin` (наприклад, `.env.local` з `NEXT_PUBLIC_*`).

---

## Принципи (коротко)

- **Backend:** Controller → Service → Repository; Prisma лише в репозиторії; DTO з валідацією; обережно зі зміною схеми після запуску.
- **Frontend:** за замовчуванням Server Components; клієнт до API через **`lib/api/client`**; форми — RHF + Zod; не рендерити небезпечний HTML без санітизації (**DOMPurify**).
- **Безпека:** httpOnly cookies для JWT, не віддавати паролі з API, CORS / Helmet / rate limiting у міру впровадження.
- **Git:** Conventional Commits (`feat:`, `fix:`, `chore:` тощо).

---

## Ліцензія

Кореневий `package.json`: `private: true`, поле `license` — згідно з твоїм вибором (наразі **ISC** у монорепо).
