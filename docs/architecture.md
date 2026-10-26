# Архітектура 12Yards

> Як влаштована система — для розбору коду. Правила (як писати код) — [`rules/`](rules/); рішення (чому так) — [`decisions/`](decisions/README.md); план — [`football-plan.md`](football-plan.md).
> Детальна карта модулів API і web (маршрути, файли, коди помилок) поки живе в `CLAUDE.md`; після M1.1 переїде сюди, а `CLAUDE.md` підключатиме цей файл через `@docs/architecture.md`.

## Загальна схема

```
Браузер ──► web (Next.js 16, :3000) ──► API (NestJS, :4000, /api/v1) ──► PostgreSQL (Supabase)
        └─► admin (Next.js 16, :3001) ─┘            │
                                                    └──► football-data.org (лише синк, через порт FootballProvider)
```

- **Наша БД — джерело правди.** Публічні `GET` читають лише Prisma; зовнішнє API викликає тільки синк (виняток — `live-touch`).
- **Домени БД** (схема v5): identity · moderation · content · engagement · football · sync ([`decisions/v5-foundation.md`](decisions/v5-foundation.md), розділ 4). FOOTBALL-таблиці про провайдерів не знають — id провайдера лише в `*ExternalRef`.
- **Auth:** access-JWT 15 хв (`sid`) + opaque refresh-сесії в БД, httpOnly cookies ([`decisions/v5-identity.md`](decisions/v5-identity.md)).
- **Контракт API** ([D28](decisions/D28-openapi-contract.md)): OpenAPI-документ будується з коду API (`@nestjs/swagger` + CLI-плагін: схема відповіді — тип, який повертає метод контролера) → `packages/types/openapi.json` → `openapi-typescript` → типи web і admin. `pnpm gen:api-types` — без сервера й БД; контрактні e2e звіряють реальні відповіді з документом, повний прогін — ще й те, що в кожної операції перевірено успішну відповідь (M1.4.9). Swagger UI — `/api/docs` (не на проді).
- **Один інстанс API**: ліміти, черга провайдера, кеш — у пам'яті процесу ([D41](decisions/D41-single-instance-scaling.md)).
- **Спільні пакети:** `packages/types` — типи API з OpenAPI (лише типи); `packages/validation` — межі полів, zod-схеми форм, slug (`slugify`), адреси сторінок сайту (`publicTagPath`, [D51](decisions/D51-admin-tags.md)) і посилання YouTube (`parseYouTubeVideoId`, [D54](decisions/D54-post-video.md)), збирається в `dist`, бо його імпортує API (CommonJS); `packages/ui` — спільний UI web і admin (Markdown-рендерер `MarkdownContent`, [D25](decisions/D25-markdown-content.md)) без збірки: застосунки компілюють його джерела самі (`transpilePackages`), класи Tailwind бачать через `@source` ([D49](decisions/D49-shared-ui-package.md)).

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

Повний перелік усіх змінних із поясненнями — `apps/{api,web,admin}/.env.example`; змінні API перевіряє одна схема при старті — `apps/api/src/config/env.schema.ts`.

**`apps/api/.env`**

| Змінна | Призначення |
|--------|-------------|
| `FOOTBALL_API_KEY` | **Токен** з football-data.org |
| `FOOTBALL_API_URL` | За замовчуванням `https://api.football-data.org/v4`; лише https (ключ іде в заголовку) |
| `FOOTBALL_LIVE_CRON_ENABLED` | `true` — кожні 5 хв LIVE-синк турнірів, де зараз є матч; інакше лише on-demand |
| `FOOTBALL_HTTP_LOG` | `true` / `false` — логувати кожен запит до football-data; за замовчуванням `true` лише при `NODE_ENV=development` |

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
| Football: турнір «у грі» в публічних відповідях (`LeagueDto.isInPlay`), клуб за slug ([D52](decisions/D52-news-feed.md)) | `apps/api/src/football/query/football-response.ts` (`toPublicLeague`), `persistence/football.repository.ts` (`findActiveLeagues`, `findLeagueBySlug`, `findClubBySlug`) |
| Football: для форми новини — усі турніри, пошук клубів ([D48](decisions/D48-competition-in-play.md)) | `apps/api/src/football/query/football-admin-query.service.ts`, `persistence/football-admin.repository.ts`; правила — `football-club-search.ts`, `football-competition-status.ts` (турнір «у грі») |
| Football: **повний синк** | `apps/api/src/football/sync/football-sync.service.ts` + `football-sync.writer.ts` |
| Football: **LIVE** (`live-touch`, LIVE-cron) | `apps/api/src/football/sync/football-live-sync.service.ts`, `football-live-throttle.service.ts` |
| Football: порт провайдера | `apps/api/src/football/integration/football-provider.port.ts` |
| Football: football-data (HTTP-черга, mapper) | `apps/api/src/football/integration/football-data/` |
| Football: константи, LIVE-вікно | `apps/api/src/football/football.constants.ts`, `football-match-status.ts` |
| Football: утиліти (тури) | `apps/api/src/football/football-matchday.util.ts` |
| Football: Prisma | `apps/api/src/football/persistence/` (читання, записи синку, `*ExternalRef`, `SyncRun`) |
| Football: cron | `apps/api/src/football/sync/football.cron.ts` |
| Схема БД | `apps/api/prisma/schema.prisma` |
| Змінні середовища API (схема, доступ) | `apps/api/src/config/env.schema.ts`, `env.config.ts`; шаблон — `apps/api/.env.example` |
| Health (`GET /api/v1/health`, ping БД) | `apps/api/src/health/health.controller.ts` |
| E2E API: каркас (схема `e2e`, застосунок, логін) | `apps/api/test/support/`; тести — `apps/api/test/<модуль>/*.e2e-spec.ts` ([D30](decisions/D30-testing-and-local-env.md)) |
| Стрічка новин `/news` (фільтри в адресі, вкладки ліг, чипи, «Завантажити ще») | `apps/web/src/app/[locale]/news/(feed)/` (`page.tsx`, `NewsFeedView`, `error.tsx`); блоки — `components/news/`; правила — `lib/news/news-feed-filters.ts`, `news-feed-pages.ts`, турніри вкладок — `lib/football/in-play-leagues.ts`, запит — `news-feed-query.ts`; хуки — `hooks/useNewsFeed.ts`, `useNewsFeedFilters.ts` ([D52](decisions/D52-news-feed.md)) |
| Картка новини (стрічка й головна), рубрика | `apps/web/src/components/news/NewsCard.tsx`, `NewsCardList.tsx`; рубрика — `PostKickerLink`, правило — `lib/news/post-kicker.ts` ([D52](decisions/D52-news-feed.md)) |
| Сторінка новини (хлібні крихти, Markdown, теми, JSON-LD, метадані) | `apps/web/src/app/[locale]/news/[slugAndNumber]/` (`page.tsx`, `NewsPostView` і блоки, `error.tsx`); правила — `lib/news/post-topics.ts`, `post-metadata.ts`, `lib/seo/json-ld.ts`, адреса сайту — `lib/site-url.ts` (серверна `SITE_URL`: схема — `lib/env/`, перевірка при старті — `src/instrumentation-node.ts`: Next збирає `instrumentation.ts` і для Edge, тож там лише вибір середовища, а `process.exit` і перевірка — у файлі тільки для Node); JSON-LD — `components/seo/JsonLd`; текст — `MarkdownContent` з `packages/ui` ([D53](decisions/D53-news-page.md)); відео — `PostVideo`, прев'ю й CSP — `apps/web/next.config.ts` ([D54](decisions/D54-post-video.md)) |
| Головна (блоки незалежні, порядок у DOM, JSON-LD `WebSite` і `Organization`) | `apps/web/src/app/[locale]/(home)/` (`page.tsx`, `error.tsx`); новини — `components/home/` (`HomeNews`, скелетон, `home-news-layout.ts`), запит — `hooks/useHomeNews.ts`; стрічка матчів — `components/home/HomeMatchStrip*`, `HomeMatchCard`, хуки `useHomeMatchStrip`, `useHorizontalScroller`, правила — `lib/football/home-match-strip.ts`, опитування — `match-polling.ts` (і `/matches`); найближчий матч — API `GET /football/matches/next-kickoff`; повний збій — `lib/home/home-blocks.ts` ([D55](decisions/D55-home-page.md)) |
| Сайдбар на головній | `apps/web/src/components/football/FootballSidebar.tsx`; перемикач — турніри «у грі» + обраний (`lib/football/in-play-leagues.ts`) |
| Хуки / query keys футболу | `apps/web/src/hooks/useFootball.ts` (`leagueDashboardQueryOptions`) |
| Ліга сайдбару за замовчуванням (спершу «у грі», D55) | `apps/web/src/lib/football/default-league.ts` |
| Синк з адмінки | `apps/admin/src/components/FootballSyncButton.tsx` |
| Журнал синків в адмінці | `apps/admin/src/components/SyncRunsTable.tsx`, `hooks/useSyncRuns.ts` |
| Панель адміна | `apps/admin/src/components/AdminShellBar.tsx`, `app/dashboard/layout.tsx` |
| Форма новини в адмінці (створення й редагування) | `apps/admin/src/components/post-form/` — `PostForm`; правила полів — `postFormSchema.ts`, тіло `PUT` (лише змінене) — `postFormEdit.ts`, статуси за станом новини — `publicationOptions.ts` ([D50](decisions/D50-admin-post-editing.md)); теги, клуби, турніри — `PostRelationsFields` і вибір пошуком `components/entity-picker/`, правила набору — `postRelations.ts`, новий тег з форми — `NewTagDialog` ([D51](decisions/D51-admin-tags.md)) |
| Редагування новини в адмінці | `apps/admin/src/app/dashboard/posts/[id]/` (`EditPostView`, `EditPostForm`, `DeletePostSection`) |
| Список новин в адмінці (фільтр, пошук, стан в URL) | `apps/admin/src/app/dashboard/posts/` (`PostsListView` і блоки); стан ↔ адреса — `lib/postListParams.ts`, `hooks/usePostListUrl.ts`; повернення до списку — `hooks/useLastPostListHref.ts` ([D50](decisions/D50-admin-post-editing.md)) |
| Теги в адмінці (сторінка «Теги») | `apps/admin/src/app/dashboard/tags/`; спільне з формою новини — `components/tags/` (поля назв, схожі теги, попередження «так звуть клуб / турнір», правила `tagForm.ts`); правила списку й збігу — `lib/tagNames.ts`, `lib/footballNameMatches.ts`; схема форми — `packages/validation/src/forms.ts` (`tagFormSchema`) ([D51](decisions/D51-admin-tags.md)) |
| Незбережені зміни в адмінці | сторож — `apps/admin/src/lib/unsavedChanges.ts`, `providers/UnsavedChangesProvider.tsx`, `hooks/useUnsavedChangesGuard.ts`; посилання — `components/AdminLink.tsx` (`next/link` напряму забороняє ESLint) |

---

## Масштабування

Розділення Query / Sync, `FootballDataClient` з чергою, `GET …/dashboard`, `POST /sync` → 202 + фон, `FootballLiveThrottleService` на `SyncRun` — уже є. Далі — за тригерами: Redis, окремий worker синку, кеш — [D41](decisions/D41-single-instance-scaling.md), [D35](decisions/D35-caching-measure-first.md); черги задач (BullMQ) — коли з'являться довгі фонові задачі з повторами.
