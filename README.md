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
  - турніри (`Competition`) і сезони (`Season`) — окремо: клуб бере участь у сезоні турніру (`SeasonClub`), тож Arsenal одночасно в PL і CL; матчі й таблиці прив'язані до сезону, минулі сезони лишаються;
  - синкаються турніри з **`Competition.isActive`** (seed створює 9); id провайдера — лише в `*ExternalRef`, **дельта** за `payloadHash` (без змін — жодного запису);
  - **cron:** повний синк активних турнірів кожні **2 години** (якщо задано `FOOTBALL_API_KEY`): рівно **4 запити** на турнір;
  - **LIVE-cron** за замовчуванням **вимкнено**; оновлення при відкритті сторінки незавершеного матчу через **`POST /football/live-touch`** (не частіше 60 с на турнір);
  - кожен запуск — рядок **`SyncRun`** (лок + журнал): другий синк того ж турніру не стартує, хід видно в адмінці;
  - у **режимі розробки** (`NODE_ENV=development`) або при **`FOOTBALL_HTTP_LOG=true`** у консоль API логуються **усі HTTP-запити** до football-data (URL, статус, скільки запитів лишилось на хвилину).
  - **Шари:** `integration/` (порт `FootballProvider` + адаптер football-data), `persistence/`, `sync/` (`FootballSyncService`, `FootballLiveSyncService`, cron), `query/` (`FootballQueryService`).
  - **`POST /football/sync`** повертає **202** і виконує імпорт **у фоні** (журнал — `GET /football/sync-runs`, адмінка).

### Web (Next.js)

- Головна: **двоколонковий layout** — зліва сайдбар (**перемикач турнірів** «Ліги» / «Кубки», **таблиця** ліги / ліга-фази / групового етапу, **майбутні / минулі тури**; у кубках тури — за стадіями: «1/8 фіналу», «Фінал»), справа банер + стрічка новин (`HomeFeed`).
- Дані футболу: **`GET /football/leagues`** (перемикач) + **`GET /football/leagues/:slug/dashboard`** одним запитом; обрана ліга — у **`?league=`** (SSR + prefetch; перемикання на клієнті без перезавантаження, «Назад» працює).
- Сторінка **`/matches/[id]`** — деталі матчу; для незавершеного матчу викликається `live-touch`, під час гри (LIVE / перерва) — refetch з БД кожні 45 с.
- Типи та хуки: `apps/web/src/lib/api/types.ts`, `hooks/useFootball.ts`, `hooks/useSelectedLeague.ts`, компоненти **`components/football/FootballSidebar.tsx`**, `sidebar/FootballLeagueSwitcher.tsx`.

### Admin (Next.js)

- Логін, дашборд, пости (список, створення з перекладами EN + опційно UA).
- Картка **Football data** → `POST /football/sync` (**202**, синк у фоні) + **журнал синків** (статус, тривалість, що записано, помилка).
- Верхня панель **`AdminShellBar`**: посилання на дашборд, пости, **публічний сайт** (URL з `NEXT_PUBLIC_PUBLIC_WEB_URL`), кнопка **Вийти** → `POST /auth/logout` + очищення клієнтського кешу запитів.

---

## Football: як це працює (для розбору коду)

### Ідея «джерело правди»

1. **Зовнішнє API** (football-data) викликається **тільки** з `sync/` через порт **`FootballProvider`** (адаптер `integration/football-data/`); усі запити процесу йдуть **однією чергою** (≥ 6,5 с між ними, free tier — 10 / хв).
2. Публічні ендпоінти **`GET /football/...`** читають **тільки Prisma** — зручно для фронту (один origin через API, без CORS до football-data з браузера).
3. Формат football-data знає **лише** `football-data.mapper.ts`; синк працює з нейтральними типами. Особливості провайдера (перевірено на реальних відповідях): пагінацію матчів ігнорує, `fullTime` містить серію пенальті (маппер віднімає), для EC 2024 таблиці немає (404).

### Типовий потік «перший запуск»

1. У **`apps/api/.env`** виставити **`FOOTBALL_API_KEY`** — це **API Token** з кабінету football-data, **не** числовий id змагання і не код **PL**.
2. Турніри вже в БД після `db:seed` (9 шт., `Competition.isActive`); вимкнути турнір — `isActive = false` (зникне з перемикача, сторінки лишаться).
3. Залогінитись в **адмінці** → **Синк**; API одразу відповідає **202**, імпорт іде **у фоні** (~30 с на турнір, 9 турнірів ≈ 4–5 хв) — хід видно в **журналі синків** на дашборді.
4. Перевірити **`GET /api/v1/football/leagues`** — лише активні турніри, з `currentSeason`.
5. У **`apps/web/.env.local`** за бажанням виставити **`NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG`** як **`Competition.slug`** (наприклад **`PL`**) — ліга сайдбару без `?league=`; якщо не задано або ліга неактивна — перша активна за `sortOrder`.

### Важливі ендпоінти Football

| Метод | Шлях | Хто | Призначення |
|--------|------|-----|-------------|
| GET | `/football/leagues` | публічно | Активні турніри (`type`, `area`, `emblemUrl`, `currentSeason`) — для перемикача |
| GET | `/football/leagues/:slug` | публічно | Мета турніру (і неактивного) |
| GET | `/football/leagues/:slug/standings?season=` | публічно | Таблиці сезону: `[{ stage, groupName, type, rows }]` |
| GET | `/football/leagues/:slug/clubs?season=` | публічно | Клуби сезону (через `SeasonClub`) |
| GET | `/football/leagues/:slug/matches?season=&stage=&page=&limit=` | публічно | Матчі сезону, для кубків — фільтр за стадією |
| GET | `/football/leagues/:slug/fixtures?season=` | публічно | Майбутні / минулі тури `{ stage, matchday, matches }` (плей-оф — уся стадія, `matchday: null`) |
| GET | `/football/leagues/:slug/dashboard?season=` | публічно | `{ league, season, standingsTable, standings, fixtures }` **одним** запитом (для UI) |
| GET | `/football/matches/:id` | публічно | Матч + ліга + сезон, half-time, пенальті, переможець |
| POST | `/football/live-touch` | публічно (10 / хв на IP) | `{ "matchId": "..." }` — LIVE-синк турніру, якщо матч іде або от-от почнеться |
| POST | `/football/sync` | **ADMIN** | **202** — повний імпорт **у фоні**; тіло опційно `{ "competitionIds": ["PL"] }` (slug-и; без тіла — усі активні) |
| GET | `/football/sync-runs?limit=` | **ADMIN** | Журнал синків (`SyncRun`) |

`season` — `2025-26` (сезон через рік) або `2026`; без нього — поточний сезон.

### Змінні середовища (football)

**`apps/api/.env`**

| Змінна | Призначення |
|--------|-------------|
| `FOOTBALL_API_KEY` | **Токен** з football-data.org |
| `FOOTBALL_API_URL` | За замовчуванням `https://api.football-data.org/v4` |
| `FOOTBALL_LIVE_CRON_ENABLED` | `true` — кожні 5 хв LIVE-синк турнірів, де зараз є матч; інакше лише on-demand |
| `FOOTBALL_HTTP_LOG` | `true` — логувати кожен запит до football-data (у dev це й так увімкнено) |

**`apps/web/.env.local`**

| Змінна | Призначення |
|--------|-------------|
| `NEXT_PUBLIC_API_URL` | База API, напр. `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG` | Ліга сайдбару без `?league=` (немає / неактивна — перша активна за `sortOrder`) |

**`apps/admin/.env.local`**

| Змінна | Призначення |
|--------|-------------|
| `NEXT_PUBLIC_API_URL` | Як у web |
| `NEXT_PUBLIC_PUBLIC_WEB_URL` | URL публічного сайту для посилань «на сайт» (напр. `http://localhost:3000`) |

### Чому таблиця (standings) може бути порожня

- На **безкоштовному** тарифі football-data **частина ресурсів** може бути недоступна: напр. standings **EC 2024** → **HTTP 404**. Синк тоді завершується `SUCCEEDED` з `standingsUnavailable: true` (журнал синків), наявна таблиця не стирається.
- Таблиця замінюється лише для тих `(stage, group, type)`, які повернув провайдер; `stats.standingsRows` у журналі — скільки рядків записано.

---

## Карта файлів (щоб швидко знайти логіку)

| Що | Де |
|----|-----|
| Football: маршрути | `apps/api/src/football/football.controller.ts` |
| Football: **читання** з БД | `apps/api/src/football/query/football-query.service.ts` (+ `football-response.ts`, `football-standings.util.ts`) |
| Football: **повний синк** | `apps/api/src/football/sync/football-sync.service.ts` + `football-sync.writer.ts` |
| Football: **LIVE** (`live-touch`, LIVE-cron) | `apps/api/src/football/sync/football-live-sync.service.ts`, `football-live-throttle.service.ts` |
| Football: порт провайдера | `apps/api/src/football/integration/football-provider.port.ts` |
| Football: football-data (HTTP-черга, mapper) | `apps/api/src/football/integration/football-data/` |
| Football: константи, LIVE-вікно | `apps/api/src/football/football.constants.ts`, `football-match-status.ts` |
| Football: утиліти (тури) | `apps/api/src/football/football-matchday.util.ts` |
| Football: Prisma | `apps/api/src/football/persistence/` (читання, записи синку, `*ExternalRef`, `SyncRun`) |
| Football: cron | `apps/api/src/football/sync/football.cron.ts` |
| Схема БД | `apps/api/prisma/schema.prisma` |
| Сайдбар на головній | `apps/web/src/components/football/FootballSidebar.tsx` |
| Хуки / query keys футболу | `apps/web/src/hooks/useFootball.ts` (`leagueDashboardQueryOptions`) |
| Slug ліги для SSR | `apps/web/src/app/resolveDefaultLeagueSlug.ts` |
| Синк з адмінки | `apps/admin/src/components/FootballSyncButton.tsx` |
| Журнал синків в адмінці | `apps/admin/src/components/SyncRunsTable.tsx`, `hooks/useSyncRuns.ts` |
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
