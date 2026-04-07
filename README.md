# Football Portal

Футбольний портал: **новини**, **коментарі**, **дані про ліги та матчі** (синхронізація з зовнішнім API з збереженням у власній БД). Проєкт зібраний як **production-oriented monorepo**: акцент на чистій архітектурі бекенду та фронтенду, TanStack Query на фронті та безпеці (JWT у httpOnly cookies).

---

## Стек

| Шар | Технології |
|-----|------------|
| **Web** | Next.js 16 (App Router), React 19, Tailwind 4, React Hook Form, Zod, Zustand, **TanStack Query** |
| **Admin** | Next.js 16 (порт **3001**), TanStack Query |
| **API** | NestJS 11, Prisma 7, PostgreSQL, JWT (httpOnly cookies), class-validator, **axios**, **@nestjs/schedule** |
| **Monorepo** | pnpm workspaces, Turborepo |
| **Спільне** | `packages/types`, `packages/config` |

---

## Структура репозиторію

```
football-portal/
├── apps/
│   ├── web/          # Публічний сайт (:3000)
│   ├── admin/        # Адмін-панель (:3001)
│   └── api/          # REST API (:4000), Prisma, NestJS
├── packages/
│   ├── types/
│   └── config/
├── football-plan-new.md   # майстер-план етапів
├── CLAUDE.md              # стислий контекст для розробки
└── README.md              # цей файл
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

Створи **`apps/api/.env`** (не коміть у git): мінімум `DATABASE_URL`; для Supabase з pooler зазвичай ще **`DIRECT_URL`** для міграцій (див. `apps/api/prisma.config.ts`).

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

---

## Порти та префікс API

| Застосунок | Порт |
|------------|------|
| Web | 3000 |
| Admin | 3001 |
| API | 4000 |

Усі маршрути Nest мають префікс **`/api/v1`** (`main.ts`). Фронти звертаються до `NEXT_PUBLIC_API_URL`, наприклад `http://localhost:4000/api/v1`.

---

## Що вже реалізовано (стан проєкту)

### Backend (NestJS)

- **Auth:** реєстрація, логін, логаут; JWT access + refresh у **httpOnly cookies**; guards для захищених маршрутів і ролі **ADMIN**.
- **Пости:** CRUD з **перекладами** (`PostTranslation`), мова через query `lang`, soft delete для постів.
- **Коментарі:** до постів і до матчів (`postId` / `matchId`), відповіді через `parentId`.
- **Football-модуль** (`apps/api/src/football/`):
  - дані з [football-data.org](https://www.football-data.org/) v4 **лише під час синхронізації**;
  - **читання для клієнтів** — з **PostgreSQL** (Prisma), без прямих викликів зовнішнього API з кожного GET;
  - **upsert** ліг, клубів, матчів; таблиця **`LeagueTable`** перезаписується цілком після успішного парсингу standings;
  - поле **`Match.matchday`** — номер туру з API для групування «майбутні / минулі тури» у UI;
  - **slug ліги** у БД: код змагання у верхньому регістрі (**PL**, **CL** тощо); при **оновленні** існуючої ліги **slug більше не перезаписується** (щоб не зламати ручні правки);
  - **cron:** повний синк матчів + таблиці кожні **2 години** (якщо задано `FOOTBALL_API_KEY`);
  - **LIVE-cron** за замовчуванням **вимкнено**; оновлення LIVE при відкритті сторінки матчу через **`POST /football/live-touch`** (з троттлінгом на змагання);
  - у **режимі розробки** (`NODE_ENV=development`) або при **`FOOTBALL_HTTP_LOG=true`** у консоль API логуються **усі HTTP-запити** до football-data (URL, статус відповіді).
  - **Шари:** `FootballQueryService` (GET), `FootballSyncService` (синк/LIVE), `FootballDataClient` (axios), `FootballLiveThrottleService`; утиліти без Nest у `football-*-util.ts`.
  - **`POST /football/sync`** повертає **202** і виконує імпорт **у фоні** (див. логи Nest).

### Web (Next.js)

- Головна: **двоколонковий layout** — зліва сайдбар (**таблиця ліги**, **майбутні / минулі тури**), справа банер + стрічка новин (`HomeFeed`).
- Дані футболу: **`GET /football/leagues/:slug/dashboard`** одним запитом; **prefetch** `leagueDashboardQueryOptions` + пости.
- Сторінка **`/matches/[id]`** — деталі матчу; для **LIVE** викликається `live-touch` і періодичний refetch з БД.
- Типи та хуки: `apps/web/src/lib/api/types.ts`, `hooks/useFootball.ts`, компонент **`components/football/FootballSidebar.tsx`**.

### Admin (Next.js)

- Логін, дашборд, пости (список, створення з перекладами EN + опційно UA).
- Картка **Football data** → `POST /football/sync` (**202**, синк у фоні; прогрес у терміналі API).
- Верхня панель **`AdminShellBar`**: посилання на дашборд, пости, **публічний сайт** (URL з `NEXT_PUBLIC_PUBLIC_WEB_URL`), кнопка **Вийти** → `POST /auth/logout` + очищення клієнтського кешу запитів.

---

## Football: як це працює (для розбору коду)

### Ідея «джерело правди»

1. **Зовнішнє API** (football-data) викликається **тільки** з **`FootballSyncService`** через **`FootballDataClient`** (axios).
2. Публічні ендпоінти **`GET /football/...`** читають **тільки Prisma** — зручно для фронту (один origin через API, без CORS до football-data з браузера).
3. Маппінг відповідей зовнішнього API → наші enum/поля зосереджений у **`football.mapper.ts`** (щоб зміни в API не розмазувалися по всьому сервісу).

### Типовий потік «перший запуск»

1. У **`apps/api/.env`** виставити **`FOOTBALL_API_KEY`** — це **API Token** з кабінету football-data, **не** числовий id змагання і не код **PL**.
2. **`FOOTBALL_COMPETITION_IDS`** — через кому: коди (**PL**, **CL**) або числові id; обидва варіанти валідні в URL `/v4/competitions/{ref}/...`.
3. Залогінитись в **адмінці** → **Синк**; API одразу відповідає **202**, а імпорт іде **у фоні** — зачекай **багато хвилин** і дивись **логи Nest** (пауза **~6.5 с** між запитами).
4. Перевірити **`GET /api/v1/football/leagues`** — подивитись реальний **`slug`** ліги в БД.
5. У **`apps/web/.env.local`** виставити **`NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG`** **точно** як **`League.slug`** (наприклад **`PL`**), інакше сайдбар отримає 404 по standings/fixtures.

### Важливі ендпоінти Football

| Метод | Шлях | Хто | Призначення |
|--------|------|-----|-------------|
| GET | `/football/leagues` | публічно | Список ліг з БД |
| GET | `/football/leagues/:slug` | публічно | Мета ліги |
| GET | `/football/leagues/:slug/standings` | публічно | Турнірна таблиця з БД |
| GET | `/football/leagues/:slug/fixtures` | публічно | Майбутні / минулі тури (згруповані по `matchday`) |
| GET | `/football/leagues/:slug/dashboard` | публічно | Таблиця + тури **одним** запитом (рекомендовано для UI) |
| GET | `/football/matches/:id` | публічно | Матч + ліга |
| POST | `/football/live-touch` | публічно | Тіло `{ "matchId": "..." }` — тригер LIVE-синку (якщо матч LIVE) |
| POST | `/football/sync` | **ADMIN** | **202** — повний імпорт **у фоні**; тіло опційно `{ "competitionIds": ["PL"] }` |

### Змінні середовища (football)

**`apps/api/.env`**

| Змінна | Призначення |
|--------|-------------|
| `FOOTBALL_API_KEY` | **Токен** з football-data.org |
| `FOOTBALL_API_URL` | За замовчуванням `https://api.football-data.org/v4` |
| `FOOTBALL_COMPETITION_IDS` | Напр. `PL` або `2021` або `PL,CL` |
| `FOOTBALL_LIVE_CRON_ENABLED` | `true` — кожні 5 хв плановий LIVE-синк; інакше лише on-demand |
| `FOOTBALL_HTTP_LOG` | `true` — логувати кожен запит до football-data (у dev це й так увімкнено) |

**`apps/web/.env.local`**

| Змінна | Призначення |
|--------|-------------|
| `NEXT_PUBLIC_API_URL` | База API, напр. `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG` | Slug ліги в БД для сайдбару на головній |

**`apps/admin/.env.local`**

| Змінна | Призначення |
|--------|-------------|
| `NEXT_PUBLIC_API_URL` | Як у web |
| `NEXT_PUBLIC_PUBLIC_WEB_URL` | URL публічного сайту для посилань «на сайт» (напр. `http://localhost:3000`) |

### Чому таблиця (standings) може бути порожня

- На **безкоштовному** тарифі football-data **частина ресурсів** (зокрема standings для деяких ліг) може повертати **порожній** масив при **HTTP 200** — це обмеження провайдера, не баг Prisma.
- У коді додано **`?season=YYYY`** до запиту standings (рік з `currentSeason` змагання) і fallback на **першу непорожню** групу standings, якщо тип **TOTAL** порожній.
- У логах API після синку шукай рядки **`[football standings]`** — там видно, скільки груп і рядків прийшло з API і скільки записано в БД.

---

## Карта файлів (щоб швидко знайти логіку)

| Що | Де |
|----|-----|
| Football: маршрути | `apps/api/src/football/football.controller.ts` |
| Football: **читання** з БД | `apps/api/src/football/football-query.service.ts` |
| Football: **синк / LIVE** | `apps/api/src/football/football-sync.service.ts` |
| Football: HTTP до football-data | `apps/api/src/football/football-data.client.ts` |
| Football: троттлінг LIVE | `apps/api/src/football/football-live-throttle.service.ts` |
| Football: константи / env ids | `apps/api/src/football/football.constants.ts` |
| Football: утиліти (тури, standings) | `football-matchday.util.ts`, `football-standings.util.ts` |
| Football: Prisma | `apps/api/src/football/football.repository.ts` |
| Football: mapper | `apps/api/src/football/football.mapper.ts` |
| Football: cron | `apps/api/src/football/football.cron.ts` |
| Схема БД | `apps/api/prisma/schema.prisma` |
| Сайдбар на головній | `apps/web/src/components/football/FootballSidebar.tsx` |
| Хуки / query keys футболу | `apps/web/src/hooks/useFootball.ts` (`leagueDashboardQueryOptions`) |
| Slug ліги для SSR | `apps/web/src/app/resolveDefaultLeagueSlug.ts` |
| Синк з адмінки | `apps/admin/src/components/FootballSyncButton.tsx` |
| Панель адміна | `apps/admin/src/components/AdminShellBar.tsx`, `app/dashboard/layout.tsx` |

---

## Принципи розробки (коротко)

- **Backend:** Controller → Service → Repository; Prisma лише в репозиторії; DTO з валідацією; зовнішні API — через окремий **mapper**.
- **Frontend:** RSC + prefetch де доречно; **`lib/api/http.ts`** + TanStack Query; форми — RHF + Zod; небезпечний HTML — з **DOMPurify** (коли підключите).
- **Безпека:** httpOnly cookies для JWT; не віддавати зайві поля з API; CORS налаштований під localhost web/admin.
- **Git:** Conventional Commits (`feat:`, `fix:`, `chore:` тощо).

### Подальше масштабування

Розділення **Query / Sync**, **FootballDataClient**, утиліти **matchday / standings**, **FootballLiveThrottleService** (заміна на Redis при кількох інстансах), **`GET …/dashboard`**, **`POST /sync` → 202** + фон.

Далі за потреби: **BullMQ** (статус джоби, retry), інтеграційні тести, кеш таблиці (Redis).

---
