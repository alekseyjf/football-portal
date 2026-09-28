# Football Portal — Project Context

## Stack
- **Web** (port 3000): Next.js 16, React 19, Tailwind 4, React Hook Form + Zod, Zustand, **TanStack Query** (`prefetchQuery` + `HydrationBoundary` для головної, новини й матчу; хуки для коментарів і auth), **next-intl** (маршрути `app/[locale]/…`, локалі лише `en` | `ua`)
- **Admin** (port 3001): Next.js 16, React Hook Form + Zod, Zustand, **TanStack Query** (пости, логін, створення поста)
- **API** (port 4000): NestJS, Prisma 7, PostgreSQL (Supabase), JWT httpOnly cookies
- **Monorepo**: pnpm + Turborepo
- `packages/types` — shared TypeScript types
- `packages/validation` — спільні межі валідації: `.` — числа (API DTO на class-validator), `./forms` — zod-схеми форм web/admin. Збирається в `dist` (turbo `dev`/`build` — першим; `pnpm install` — через `prepare`)
- `packages/config` — shared tsconfig, eslint

## Auth
- Access JWT 15 хв (HS256, `{ sub, role, sid }`, `sid` = `AuthSession.familyId`) + opaque refresh (у БД — SHA-256), **httpOnly cookies**; refresh — ротація, ковзне вікно 7 д, **абсолютний ліміт 30 д** від логіну
- `JwtStrategy` на кожен запит перевіряє, що сесія `sid` жива → logout / logout-all / блокування гасять access одразу
- Roles: `ADMIN`, `USER`; Guards: `JwtAuthGuard`, `RolesGuard`, `@Roles('ADMIN')` decorator
- Адмінка логіниться через `POST /auth/login/admin` (не-ADMIN → 403 `ADMIN_ONLY`, сесія не створюється); cookies спільні на localhost
- Пароль: новий ≥ 8 і ≤ 72 **байти** UTF-8 (межа bcrypt; `PASSWORD_MAX_BYTES`, API — `@MaxUtf8Bytes`, межі — `packages/validation`); логін — без мінімуму (старі акаунти)

## Database (Prisma schema v5)
Джерело правди — `apps/api/prisma/schema.prisma` + `prisma/sql/constraints.sql` (CHECK і partial unique, яких Prisma не виражає: одна ціль треду, різні клуби матчу, дата в опублікованого поста, одна default-мова, один `isCurrent` сезон, один `RUNNING` синк, формат анонімізованого email). Рішення D1–D20 — основний план, Частина 2 (повні формулювання — `docs/archive/football-plan-intermediate.md`, розділ 2). Міграції — `0001_init` … `0004`; squash — перед релізом (етап 14).
- **Identity:** `User` — лише ідентичність: email (always lowercase), `passwordHash` (bcrypt), `role`, `status` (ACTIVE | LOCKED | DELETED), `lockedAt`, `deletedAt`; `UserProfile` 1:1 — `displayName`, `avatarUrl`, `bio`; `AuthSession` — refresh-сесії (`familyId`, `tokenHash`, `expiresAt`, `revokedAt`)
- **Moderation:** `UserSanction` (історія санкцій), `RateLimitEvent` (cooldown / burst), `BlockedEmail` (HMAC пошти видаленого акаунта)
- **Content:** `Language` (`isDefault` = en) · `Post` — slug, `status` (DRAFT | SCHEDULED | PUBLISHED | ARCHIVED), `publishedAt`, `coverImageUrl`, videoUrl, sourceUrl, authorId, `likeCount` / `dislikeCount`, deletedAt (soft delete) · `PostTranslation` — `(postId, languageCode)`, title, excerpt, content · `Tag` / `TagTranslation` / `PostTag` · `PostCompetition`, `PostClub` (новини турніру / клубу)
- **Engagement:** `CommentThread` — рівно одна ціль (`postId?` | `matchId?`, CHECK), `isLocked`, `commentCount` · `Comment` — threadId, authorId, parentId?, rootId?, depth, content, replyCount, likeCount, pinnedAt, deletedAt · `PostLike` / `CommentLike` / `MatchLike` — YouTube-style (LIKE/DISLIKE, only LIKE shown publicly) · `UserReactionActivity` (журнал реакцій)
- **Football:** `Area` · `Competition` (`type` LEAGUE|CUP, `isActive`, `sortOrder`) · `Season` (`label` «2025/26» / «2026», рівно один `isCurrent`) · `SeasonClub` (M:N клуб ↔ сезон) · `Club` (`kind` CLUB|NATIONAL, `slug` не змінюється) · `Match` (`kickoffAt`, `stage`, `groupName`, half-time, пенальті, `winner`) · `Standing` (`stage`, `groupName` `''` = без групи, `type`)
- **Sync:** id провайдера — лише в `*ExternalRef` (`payloadHash`), журнал / лок — `SyncRun`. FOOTBALL-таблиці про провайдерів не знають

## API Structure (NestJS)
All routes prefixed with `/api/v1/`

### Auth — `src/auth/`
- `POST /auth/register` — public
- `POST /auth/login` — public, sets httpOnly cookies
- `POST /auth/login/admin` — public, лише ADMIN (403 `ADMIN_ONLY` до створення сесії); ліміт спроб спільний з `login`
- `POST /auth/refresh` — ротація refresh-сесії (409 `REFRESH_SUPERSEDED` — гонка вкладок)
- `POST /auth/logout` — без guard (читає refresh-cookie); `POST /auth/logout-all` — JwtAuthGuard; `GET /auth/me`
- Files: `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- DTOs: `register.dto.ts`, `login.dto.ts`
- Guards: `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts`, `guards/roles.decorator.ts`
- Strategy: `strategies/jwt.strategy.ts` — reads token from cookie `access_token`

### Posts — `src/posts/`
- **Живий пост** (`post-visibility.ts`, `livePostWhere`): `deletedAt IS NULL`, `status IN (PUBLISHED, SCHEDULED)`, `publishedAt <= now` — SCHEDULED виходить сам, без cron. Чернетки за slug → 404, лайк чернетки — 404
- `GET /posts?page=1&limit=10&lang=en` — public, живі, `publishedAt desc`; `limit` ≤ 50. Переклад розгорнуто в пост (`title`, `excerpt`) з fallback на default-мову + `resolvedLanguage`; невідомий `lang` → default
- `GET /posts/admin/all` — ADMIN, усі крім видалених: `status`, `publishedAt`, `isLive`, `translations: [{ languageCode, title }]`
- `GET /posts/:slug?lang=en` — public, живий пост + `content`, `availableLanguages`, `tags`, `competitions`, `clubs` (коментарі — окремо, `GET /comments/post/:postId`)
- `POST /posts` — **ADMIN only**, body: `{ translations: [{ languageCode, title, excerpt, content }], status?, publishedAt?, coverImageUrl?, videoUrl?, sourceUrl?, tagIds?, clubIds?, competitionIds? }`; переклад default-мови (en) обов'язковий; без `status` — DRAFT. Правила статусу / дати — `post-publication.ts` (`resolvePostPublication`)
- `PUT /posts/:id` — **ADMIN only**; переклади — upsert за мовою, масив зв'язків замінює повністю
- `DELETE /posts/:id` — ADMIN only, soft delete (sets deletedAt) → `{ id }`
- Files: `post.controller.ts`, `post.service.ts`, `post.repository.ts`, `post.module.ts`, `post-response.ts` (форма відповідей), `post-publication.ts`, `post-slug.ts`, `post-visibility.ts`
- DTOs: `post-fields.dto.ts` (спільні поля + `PostTranslationDto`), `create-post.dto.ts`, `update-post.dto.ts`, `list-posts-query.dto.ts`

### Languages — `src/languages/`
- `LanguageService` — мови з таблиці `Language` (кеш 60 с): `chooseContentLanguage(lang)` → `{ requestedCode, defaultCode }`, `getContentLanguages()` → `{ defaultCode, activeCodes }`

### Comments — `src/comments/`
- **Тред** (`CommentThread`) — один на пост / матч, створюється з першим коментарем (не на `GET`); `commentCount` = живі коментарі, `Comment.replyCount` = живі прямі відповіді; `rootId` / `depth` (≤ `MAX_COMMENT_THREAD_DEPTH` = 15) зберігаються
- `GET /comments/post/:postId` — public, дерево; неживий пост (`livePostWhere`) → 404 `POST_NOT_FOUND`, без треду → `[]`
- `GET /comments/match/:matchId` — public; матчу немає → 404 `MATCH_NOT_FOUND`
- `POST /comments` — authenticated, body: `{ content, postId? | matchId?, parentId? }` — рівно одна ціль (`COMMENT_TARGET_INVALID`); батько — живий і в тому ж треді (`PARENT_COMMENT_NOT_FOUND` / `PARENT_COMMENT_MISMATCH`), `COMMENT_DEPTH_EXCEEDED`; `isLocked` → 403 `COMMENT_THREAD_LOCKED` (ADMIN — можна)
- `DELETE /comments/:id` — author or ADMIN, **soft delete разом з усією гілкою відповідей** → `{ id, deletedCount }`; під видаленим коментарем живих немає
- `DELETE /comments/:id/purge` — **ADMIN**, ⚠️ фізичне видалення, лише без жодного дочірнього рядка (інакше 409 `COMMENT_HAS_REPLIES`)
- `DELETE /comments/:id/purge-thread` — **ADMIN**, ⚠️ фізично коментар + піддерево (гонка → 409 `COMMENT_THREAD_CHANGED`) → `{ id, purgedCount }`
- Гонки: блокування завжди **від предків до нащадків, тред — останнім**, `FOR NO KEY UPDATE` (не `FOR UPDATE` — той конфліктує з FK-`KEY SHARE` вставки відповіді → deadlock); deadlock / FK-гонка → 409 `COMMENT_THREAD_CHANGED`. Помилки Prisma — лише через `src/prisma/prisma-errors.ts`: Prisma 7 кидає deadlock як `P2010` або «голий» `DriverAdapterError`, **не** `P2034`
- Files: `comment.controller.ts`, `comment.service.ts` (транзакції; порядок блокувань батько → ціль → тред), `comment.repository.ts`, `comment-thread.repository.ts`, `comment-visibility.ts` (`visibleCommentWhere` — і для лайків), `comment-subtree.ts` (піддерево для purge-thread), `comment-thread.util.ts` (дерево), `comment-response.ts`

### Likes — `src/likes/`
- `POST /likes` `{ targetType: post|comment|match, targetId, action: LIKE|DISLIKE }` (повтор тієї ж дії знімає голос), `GET /likes/stats/:targetType/:targetId`; пост — живий, коментар — `visibleCommentWhere` (інакше 404)
- Кожна зміна — рядок `UserReactionActivity { targetType: ReactionTarget, reaction: LikeType | null }`
- Транзакція перемикання **спершу блокує рядок цілі** (`FOR NO KEY UPDATE`): паралельні кліки одного юзера йдуть по черзі, ціль, прибрана purge-ем, → 404

### Users — `src/users/`
- Видалення акаунта = **анонімізація** (D19), рядок `User` лишається: email → `deleted-<id>@removed.invalid`, профіль — «Deleted user», сесії видаляються, HMAC пошти → `BlockedEmail` (self — 30 д, admin — назавжди; повторна реєстрація → 403 `EMAIL_BLOCKED`)
- `DELETE /users/me` — JwtAuthGuard, підтвердження паролем (403 `INVALID_PASSWORD`), ліміт 5 / 15 хв на акаунт; `DELETE /users/:id` — **ADMIN**, + `UserSanction(ACCOUNT_DELETED)`
- Files: `management/user.controller.ts`, `management/user.service.ts`, `user.repository.ts`, `deleted-account.ts`, `public-author.ts` (`PublicAuthor { id, name, avatarUrl, isDeleted }`)

### Security — `src/security/`
- Анти-абуз коментарів / лайків (`abuse-protection.service.ts`): cooldown коментарів 60 с (`COMMENT_COOLDOWN_MS`), burst 5 за 5 с → санкція на дію 24 год, повторний strike → `LOCKED` + відкликання сесій (`account-moderation.service.ts`)
- `throttling/request-throttling.ts` — ліміти на IP / акаунт лише на окремих роутах (login, register, refresh, `DELETE /users/me`, `live-touch`); сховище — пам'ять процесу
- `email-blocklist/`, `security-cleanup.cron.ts` (щогодини: прострочені `AuthSession` > 7 д, `RateLimitEvent` > 24 год, `BlockedEmail`)

### Football — `src/football/` (schema v5, Фаза 5a — `docs/archive/football-plan-intermediate.md` 5.1)
- **Корінь:** `football.module.ts`, `football.controller.ts`, `football.constants.ts`, `football-match-status.ts` (`IN_PLAY` = LIVE + PAUSED, LIVE-вікно), `football-matchday.util.ts` (тури: `(stage, matchday)` у лізі / ліга-фазі / групах, плей-оф — уся стадія, `matchday: null`), `dto/*`
- **`integration/`** — порт `football-provider.port.ts` (`FootballProvider`, DI-токен `FOOTBALL_PROVIDER`, нейтральні `Provider*`, `FootballProviderError`) + адаптер `football-data/` (`client` — **одна черга запитів на процес**, ≥ 6,5 с між стартами, 429 → `X-RequestCounter-Reset`; `mapper` — **єдине** місце, що знає формат football-data; `provider`). Синк `Fd*` не бачить
- **`persistence/`** — `FootballRepository` (публічні читання), `FootballSyncRepository` (записи синку), `ExternalRefRepository` (batch resolve `*ExternalRef`), `SyncRunRepository` (журнал + лок)
- **`sync/`** — `FootballSyncService` (повний синк турніру: **рівно 4 запити** — competition, teams, matches, standings — сезон фіксується з першого), `FootballLiveSyncService` (`live-touch` + LIVE-cron), `FootballLiveThrottleService` (інтервал через `SyncRun`), `FootballSyncWriter` (спільні кроки), `football.cron.ts` (повний — кожні 2 год; LIVE — 5 хв, якщо `FOOTBALL_LIVE_CRON_ENABLED=true`)
- **`query/`** — `FootballQueryService` (усе в межах сезону: `?season=2025-26` / `2026`, інакше `isCurrent`), `football-response.ts`, `football-standings.util.ts` (головна таблиця для дашборду)
- **Правила синку:** провайдерські поля пишуться лише при зміні `payloadHash` (дельта); editorial (`slug`, `type`, `isActive`, `sortOrder`) — ніколи; `Match` не видаляється, `likeCount` / `dislikeCount` синк не пише; спільні сутності без голого `upsert` (`Area`, `SeasonClub` — `createMany skipDuplicates`; клуб + ref — одна транзакція, P2002 → відкат і повторний resolve; P2002 вкладеного ref Prisma звітує як `modelName: "Club"`); матчі — чанки по 50 в порядку `matchId`; таблиця — `(stage, groupName, type)` атомарно під `Season FOR NO KEY UPDATE`
- **Лок:** `SyncRun` `RUNNING` (partial unique) — один на provider + scope + турнір; `tryStart` під advisory-локом; застарілий `RUNNING` (повний > 10 хв, LIVE > 3 хв) → `FAILED STALE`
- **football-data (перевірено на реальних відповідях):** `limit` / `offset` на матчах ігнорує; `fullTime` **містить** серію пенальті (маппер віднімає); `standings.group` для ліг — підпис («Matchday»), не група; standings EC 2024 → 404 (= «таблиці немає»), WC 2026 — одна таблиця `GROUP_STAGE` на 48 команд (групи — лише в `Match.groupName`); збірні не позначені — `NATIONAL` за турніром (WC, EC)
- `GET /football/leagues` (лише `isActive`, `sortOrder`), `…/leagues/:slug` (будь-який — архів), `…/:slug/dashboard` (`{ league, season, standingsTable, standings, fixtures }`; `standingsTable` — `{ stage, groupName }` таблиці в `standings` або `null`), `…/:slug/standings` (`[{ stage, groupName, type, rows }]`), `…/:slug/clubs`, `…/:slug/matches?season&stage&page&limit`, `…/:slug/fixtures` (тури `{ stage, matchday, matches }`), `GET /football/matches/:id` (+ `league`, `season`). Коди: `LEAGUE_NOT_FOUND`, `SEASON_NOT_FOUND`, `MATCH_NOT_FOUND`
- `GET /football/matches?from=&to=&league=PL,CL` — матчі за часом початку `[from, to)` у всіх турнірах: межі — ISO **з поясом** (день рахує клієнт у своєму поясі), ≤ 32 доби (`MATCH_RANGE_INVALID` / `MATCH_RANGE_TOO_LONG`, `query/football-match-range.ts`); без `league` — лише `isActive`, зі slug-ами — будь-які; ≤ 1000 рядків; `{ matches: [рядок матчу + league] }`. `@IsIsoDateTimeWithZone` — `common/validation/iso-date-time.decorator.ts` (і `publishedAt` поста)
- `POST /football/sync` — **ADMIN**, **202** + фон; body `{ competitionIds?: string[] }` — **наші slug-и** (без тіла — усі активні); невідомий → 400 `UNKNOWN_COMPETITION`, без ключа → 503 `FOOTBALL_PROVIDER_NOT_CONFIGURED`. `GET /football/sync-runs?limit=` — **ADMIN**
- `POST /football/live-touch` — публічний, ліміт 10 / хв на IP; приймається для матчу в LIVE-вікні (гра йде або `SCHEDULED` у `[−3 год, +15 хв]`), LIVE-синк турніру — не частіше 60 с; лише оновлює наявні матчі, `FINISHED` → оновити таблицю

## Frontend Structure (apps/web/src/)
- i18n: `proxy.ts` (next-intl; Accept-Language `uk*` → `ua` — `i18n/accept-language.ts`), `i18n/` (routing, request, navigation), `messages/en.json` / `ua.json`; для `Intl` / дат — `uk-UA` (`lib/i18n/content-lang.ts`)
- **Дати — лише** `useDateTimeFormat()` (`hooks/`) у клієнті / `formatDateTime(value, locale, timeZone, options)` (`lib/i18n/date-time.ts`) у RSC; **не** `toLocaleString` (пояс процесу → hydration mismatch). Пояс — у конфігу next-intl: `i18n/time-zone.ts` (cookie `tz`, валідація IANA, дефолт `Europe/Kyiv`) → `i18n/request.ts`; `providers/TimeZoneSync.tsx` пише пояс браузера в cookie і робить один `router.refresh()` (порівняння через `Intl`: `Europe/Kyiv` = `Europe/Kiev`). Через `cookies()` у конфігу **усі маршрути динамічні**
- `app/layout.tsx` — лише `children`; `app/[locale]/layout.tsx` — `html` / `body`, `NextIntlClientProvider`, `QueryProviders`, Navbar
- 404 — **одна загальна** `app/not-found.tsx` (без навбару; `[locale]/not-found` і catch-all `[...rest]` свідомо не робимо): **сама рендерить `<html>` / `<body>`** (кореневий layout — лише `children`; інакше Next: «Missing <html> and <body> tags in the root layout»), фон — на обгортці `div.bg-gray-950` (правило `body` у `globals.css` поза шарами Tailwind перебиває утиліти на `body`), мова — `getLocale()`, назва — `title.absolute`. Шрифт — `app/fonts.ts` (спільний з `[locale]/layout.tsx`). Невідомий URL → повний SSR; кинутий `notFound()` сторінки — у SSR оболонка `__next_error__`, 404 малює клієнт (штатно для Next 16). Посилання на ще не існуючі сторінки — `prefetch={false}` (prefetch 404 у Chrome «не завершується»)
- `app/[locale]/matches/page.tsx` — матчі дня: `?date=YYYY-MM-DD` у поясі користувача (без нього — сьогодні) → межі `from` / `to` (`lib/i18n/zoned-date.ts`: `zonedDayRange`, `dayKeyInTimeZone`, `shiftDayKey`), `?league=`; prefetch ліг і матчів + `MatchesDayView` (групи за турнірами в порядку `sortOrder` — `lib/football/matches-page.ts`; `refetchInterval` 60 с, якщо є матч у грі; без `live-touch`). Компоненти — `components/football/matches/` (`MatchesDayNav`, `MatchesLeagueFilter`, `MatchesLeagueGroup`, `MatchListRow` — до 640 px команди одна під одною), `components/football/FootballClubCrest.tsx`; хук — `matchesInRangeQueryOptions` (`hooks/useFootball.ts`)
- `app/[locale]/page.tsx` — RSC: ліга сайдбару — `?league=` (`lib/football/league-param.ts`) або за замовчуванням (`resolveDefaultLeagueSlug`: env, якщо ліга активна, інакше перша за `sortOrder`); `fetchQuery` ліг + prefetch постів і дашборду; **один `HydrationBoundary` на всю сітку** (`FootballSidebar` + `HomeFeed`) — сайдбар у SSR з даними
- `app/[locale]/matches/[id]/` — матч (`fetchQuery` + `HydrationBoundary`, `MatchDetailView`; невідомий id → `notFound()`, HTTP 404; назва у вкладці «Господарі – Гості · Ліга» — `generateMetadata` і сторінка ділять `cache(fetchMatchDetail)`; «Усі матчі {дата}» → `/matches?date=`); незавершений (не FINISHED / CANCELLED / AWARDED / POSTPONED) → `POST /football/live-touch` (LIVE-вікно перевіряє API); у грі (LIVE / PAUSED) — refetch кожні 45 с; серія пенальті — окремим рядком; стадія / тур / група в шапці; «На головну» → `/?league=<ліга матчу>`
- `components/football/FootballSidebar.tsx` — перемикач `sidebar/FootballLeagueSwitcher.tsx` (групи «Ліги» / «Кубки» за `type`, посилання `?league=`), таблиця (заголовок за `standingsTable`), тури; `hooks/useSelectedLeague.ts` (`?league=` ↔ `history.pushState` — без серверного рендеру), `hooks/useFootballStageLabels.ts` (стадії / групи кубків), `hooks/useFootball.ts`, `hooks/useMatchStatusLabel.ts` (підпис статусу, `isMatchInPlay` / `isMatchTerminal`)
- `components/layout/LocaleSwitcher.tsx` — зміна мови зберігає query (`?league=`); до 1024 px — коди `EN` / `UA`. Навбар (`Navbar` / `NavbarClient`) без виходу за екран 320…1280 px: до 640 px — лише ⚽ і «Увійти», ім'я — від 1024 px; бургер-меню — з етапом 7.1
- `app/[locale]/news/[slug]/page.tsx` — RSC: `generateMetadata` через `apiGet`; `prefetchQuery(postDetailQueryOptions)` + `HydrationBoundary`; `NewsPostView.tsx` (`useQuery`)
- `app/[locale]/news/[slug]/CommentSection.tsx` — `useComments` / `useCreateComment` / `useDeleteComment`; вузол дерева — `components/comments/CommentThreadNode.tsx`; лайки — `components/features/LikeBar.tsx` + `hooks/useLikes.ts` (новина, коментарі, матч)
- `app/[locale]/auth/login`, `…/auth/register` — форми (React Hook Form + zod-схеми з `@football-portal/validation/forms`)
- `hooks/usePosts.ts`, `usePostDetail.ts`, `useComments.ts`, `hooks/useAuth.ts` — `useAuthQuery` (`GET /auth/me`, ключ `['auth','me']`, 401 → `null`) + мутації логін/реєстрація/logout (пишуть у кеш `me`); `useAuthorDisplayName` — «Видалений користувач» за `author.isDeleted`
- `lib/api/http.ts` — `apiGet` / `apiPost` / `apiPut` / `apiDelete(url, body?)` (credentials, JSON); **єдиний HTTP-шар**. Помилки — `ApiError { status, code, retryAfterSeconds }`. На 401 (лише в браузері; не для `/auth/login|register|refresh|logout`) — один single-flight `POST /auth/refresh` і повтор запиту; 409 від refresh = успіх (інша вкладка); лише 401/403 від refresh = вихід (`onSessionExpired`); 429 / мережа — не розлогінюють
- `lib/api/types.ts` — `Post`, `PostDetail`, `Comment`, `DEFAULT_CONTENT_LANG` (fallback перекладу робить API; `resolvedLanguage` ≠ мові сторінки → позначка «Переклад недоступний»)
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `providers/AuthSessionSync.tsx` — дзеркалить `useAuthQuery` у store, реагує на `onSessionExpired`
- `store/auth.store.ts` — Zustand, `user: User | null`, `isLoading` (read-model; писати лише через `AuthSessionSync`)

## Admin Structure (apps/admin/src/)
- `app/layout.tsx` — `QueryProviders`
- `app/dashboard/layout.tsx` — `AdminShellBar` (навігація, публічний сайт з `NEXT_PUBLIC_PUBLIC_WEB_URL`, **Вийти** → `POST /auth/logout`)
- `app/dashboard/page.tsx` — картка **Football data** + `FootballSyncButton` → `POST /football/sync`; **Журнал синків** — `SyncRunsTable` / `useSyncRuns` (`GET /football/sync-runs`, автооновлення, поки є `RUNNING`)
- `lib/publicWebUrl.ts`, `hooks/useAdminLogout.ts`, `hooks/useAdminSessionExpiry.ts` (refresh відхилено → `/login`)
- `app/login/AdminLoginForm.tsx` — `useAdminLogin` (mutation, `POST /auth/login/admin`)
- `app/dashboard/posts/page.tsx` — клієнтська сторінка, `useAdminPosts`; посилання «View on site» через `NEXT_PUBLIC_PUBLIC_WEB_URL` (fallback `http://localhost:3000`)
- `app/dashboard/posts/create/CreatePostForm.tsx` — `useCreatePost`, тіло `CreatePostDto` (EN обов'язково, UA опційно; статус Draft / Publish now / Schedule + дата)
- `hooks/useAdminPosts.ts`, `useCreatePost.ts`, `useAdminLogin.ts`
- `lib/api/http.ts` (та сама refresh-логіка, що й у web — міняти разом), `lib/api/types.ts` — `AdminPostRow`, `CreatePostPayload`, `adminPostTitle`, `adminAuthorName`
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `store/auth.store.ts`

## Architecture Rules
1. **Controller** — routing only, no logic
2. **Service** — business logic (use cases), descriptive method names
3. **Repository** — Prisma queries only, always use `select` not `include`
4. **Mapper** — external API transformation only (football module)
5. **DTO** — class-validator decorators on all inputs
6. **Soft delete** — Post and Comment use `deletedAt`, never hard delete. Єдиний виняток — ADMIN purge коментаря (`DELETE /comments/:id/purge`, `…/purge-thread`, D20: legal / GDPR)
7. **Email** — always `toLowerCase().trim()` before saving
8. **i18n** — content in PostTranslation, always pass `lang` param to queries
9. **Likes** — separate tables (PostLike/CommentLike/MatchLike), DISLIKE stored but not shown publicly
10. **Security** — DOMPurify on frontend, Helmet + CORS + ValidationPipe on backend
11. **Іменування** — у бізнес-коді та утилітах уникати одно- та дволітерних імен змінних/параметрів; мінімум **3 символи**, окрім загальноприйнятих: `id`, `url`, `err` у дуже вузькому контексті, `tx` (клієнт транзакції Prisma), індекси циклу `i`/`j` лише якщо немає семантики. Для зовнішніх DTO допускається префікс **`Fd`** (football-data.org) у типах мапера. Назви мають відображати **роль значення** (`matchFromApi`, `encodedCompetitionRef`, `clubIdByExternalTeamId`), а не форму (`map`, `row`). Детальніше: `.cursor/rules/naming-readability.mdc`.

## Environment Variables
### apps/api/.env
```
DATABASE_URL=... (Supabase: транзакційний пулер :6543)
DIRECT_URL=... (session-пулер / пряме з'єднання :5432 — для `prisma migrate` і довгих прогонів; `prisma.config.ts`)
JWT_SECRET=... (обов'язковий, ≥ 32 символи, випадковий — інакше API не стартує; HS256 для access-JWT)
PORT=4000
FOOTBALL_API_KEY=... (API Token з кабінету, НЕ id змагання)
FOOTBALL_API_URL=https://api.football-data.org/v4
FOOTBALL_LIVE_CRON_ENABLED=false
FOOTBALL_HTTP_LOG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001 (обов'язковий; через кому, рівно origin — без шляху і `/`; на проді лише https)
EMAIL_HASH_SECRET=... (обов'язковий, ≥ 32 символи, випадковий; HMAC блоклиста пошт видалених акаунтів — НЕ змінювати після запуску)
TRUST_PROXY= (порожньо в dev; на проді ОБОВ'ЯЗКОВИЙ — кількість проксі, напр. 1, або 0/false без проксі; `true` заборонено)
```
(`FOOTBALL_HTTP_LOG` — логувати всі запити до football-data; у dev це вмикається автоматично)
Опційно: `COMMENT_COOLDOWN_MS` (дефолт 60000); лише для `pnpm db:seed` без `seed-data/content.json` — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME`. Турніри для синку — з `Competition.isActive` (seed має власний список), не з env
### apps/web/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG=PL
# як у Competition.slug (код змагання, напр. PL); немає / неактивна — перша активна за sortOrder
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001 (опційно; посилання на адмінку в Navbar, це й дефолт)
```
### apps/admin/.env.local (рекомендовано)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_PUBLIC_WEB_URL=http://localhost:3000
```

## Current Status
Плани: `football-plan-new.md` — основний (етапи, чекбокси, бэклог; **«🧭 Рішення перед етапом 7»** — архітектурні рішення для етапів 7–8, 14); `docs/archive/football-plan-intermediate.md` — **архів** проміжного плану schema v5 (рішення D1–D20, P5-*, P5b-*, журнал перевірок).

**Completed:**
- Monorepo, NestJS API, web (next-intl `en` | `ua`), admin; TanStack Query + єдиний `http.ts` у web і admin
- **Schema v5** (проміжний план, Фази 0–7 ✅, 2026-09-27): baseline-міграція + `constraints.sql`; auth на refresh-сесіях (`sid`, ротація, 30 д), модерація, видалення акаунта (анонімізація); пости зі статусами, мови з БД і fallback; треди коментарів (soft delete гілкою, purge); лайки з журналом реакцій; football — порт провайдера, `*ExternalRef`, сезони, `SyncRun` (журнал + лок), дельта-синк рівно 4 запити на турнір
- Web: головна (стрічка + сайдбар ліги з SSR, перемикач ліг `?league=`, кубки), новина з коментарями й лайками, `/matches/[id]` (LIVE-touch, лайки), відновлення сесії після F5, refresh-on-401
- Admin: пости (Draft / Publish now / Schedule), синк + журнал `SyncRun`
- Хвости v5 (2026-09-28): часовий пояс дат (без hydration mismatch), невідомий матч → 404, навбар 320…1280 px, ESLint web / API — 0
- Одна загальна 404 (раніше — «Missing <html> and <body>» у dev); сторінка матчів дня `/matches` + `GET /football/matches?from&to`, пункт «Матчі» в навбарі, назва матчу у вкладці (2026-09-28; Chrome 27/27 + прод 8/8, jest 118/118)
- Перевірка: API unit (jest) 109/109; наскрізний прогін застосунку 59/59, E2E перемикача 49/49, хвости — Chrome 19/19

**Next up** (основний план):
- Етап 7.0, старт — e2e-набір на окремій БД + CI, контракт типів API ↔ web (`packages/types` → `dist`)
- Етап 7 — football-сторінки альфи (`leagues/*`, `clubs/*`, `calendar`; `matches` — ✅ матчі дня) + агреговані ендпоінти + кеш TTL; групові таблиці ЧС і сітка плей-оф; бургер-меню
- Етап 8.2 — коментарі на сторінці матчу (API готовий; спільний `CommentSection`, лайки коментарів пачкою, пагінація)
- Перед публічним продом: CSRF, підтвердження пошти (13.5), домени web / API на одному сайті (cookies), Sentry + `/health`, squash міграцій
- Вручну: прибрати з локального `apps/api/.env` `JWT_REFRESH_SECRET` і `FOOTBALL_COMPETITION_IDS` (не читаються)
