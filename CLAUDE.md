# Football Portal — Project Context

## Stack
- **Web** (port 3000): Next.js 16, React 19, Tailwind 4, React Hook Form + Zod, Zustand, Vitest (unit), **TanStack Query** (`prefetchQuery` + `HydrationBoundary` для головної, новини й матчу; хуки для коментарів і auth), **next-intl** (маршрути `app/[locale]/…`, локалі лише `en` | `uk` — той самий код у БД, API і `<html lang>`, D22)
- **Admin** (port 3001): Next.js 16, React Hook Form + Zod, Zustand, **TanStack Query** (пости, логін, створення поста)
- **API** (port 4000): NestJS, Prisma 7, PostgreSQL (Supabase), JWT httpOnly cookies
- **Monorepo**: pnpm + Turborepo; нову версію пакета pnpm бере не раніше ніж через 7 днів після публікації (`minimumReleaseAge` у `pnpm-workspace.yaml`)
- `packages/types` — типи API для web і admin, **згенеровані** з OpenAPI (D28): `pnpm gen:api-types` (без сервера й БД; і `pnpm install`) → `openapi.json` + `src/generated/openapi.ts` — **не в git**; імена (схема без `Dto`) — по файлу на сутність у теці модуля API (`src/football/match.ts`)
- `packages/validation` — спільні межі валідації: `.` — числа (API DTO на class-validator), `./forms` — zod-схеми форм web/admin. Збирається в `dist` (turbo `dev`/`build` — першим; `pnpm install` — через `prepare`)
- `packages/config` — shared tsconfig (ESLint — свій `eslint.config.mjs` у кожному застосунку; web і admin — однаковий `eslint-config-next`)

## Auth
- Access JWT 15 хв (HS256, `{ sub, role, sid }`, `sid` = `AuthSession.familyId`) + opaque refresh (у БД — SHA-256), **httpOnly cookies**; refresh — ротація, ковзне вікно 7 д, **абсолютний ліміт 30 д** від логіну
- `JwtStrategy` на кожен запит перевіряє, що сесія `sid` жива → logout / logout-all / блокування гасять access одразу
- Roles: `ADMIN`, `USER`; доступ до роуту — `@AuthRequired()` / `@AdminOnly()` / `@AuthOptional()` (`auth/guards/access.decorators.ts`: guard-и + опис у Swagger); користувач у контролері — `@CurrentUser()` / `@OptionalCurrentUser()`, не `req.user`
- Адмінка логіниться через `POST /auth/login/admin` (не-ADMIN → 403 `ADMIN_ONLY`, сесія не створюється); cookies спільні на localhost
- Пароль: новий ≥ 8 і ≤ 72 **байти** UTF-8 (межа bcrypt; `PASSWORD_MAX_BYTES`, API — `@MaxUtf8Bytes`, межі — `packages/validation`); логін — без мінімуму (старі акаунти)

## Database (Prisma schema v5)
Джерело правди — `apps/api/prisma/schema.prisma` + `prisma/sql/constraints.sql` (CHECK і partial unique, яких Prisma не виражає: одна ціль треду, різні клуби матчу, дата в опублікованого поста, одна default-мова, один `isCurrent` сезон, один `RUNNING` синк, формат анонімізованого email, формат slug-а й назва тегу). Рішення D1–D20 — `docs/decisions/v5-foundation.md` (усі рішення — `docs/decisions/`). Міграції — `0001_init` … `0009`; squash — перед першим прод-деплоєм (M3.1).
- **Identity:** `User` — лише ідентичність: email (always lowercase), `passwordHash` (bcrypt), `role`, `status` (ACTIVE | LOCKED | DELETED), `lockedAt`, `deletedAt`; `UserProfile` 1:1 — `displayName`, `avatarUrl`, `bio`; `AuthSession` — refresh-сесії (`familyId`, `tokenHash`, `expiresAt`, `revokedAt`)
- **Moderation:** `UserSanction` (історія санкцій), `RateLimitEvent` (cooldown / burst), `BlockedEmail` (HMAC пошти видаленого акаунта)
- **Content:** `Language` (`isDefault` = en) · `Post` — `number` (унікальний, послідовність; URL `{slug}-{number}`, D24), slug (з EN-заголовка, не унікальний), `status` (DRAFT | SCHEDULED | PUBLISHED | ARCHIVED), `publishedAt`, `coverImageUrl`, `coverImageCredit` (підпис автора фото, D44), videoUrl, `sourceUrl` + `sourceName` (джерело — одне на пост, D26), authorId, `likeCount` / `dislikeCount`, deletedAt (soft delete) · `PostTranslation` — `(postId, languageCode)`, title, excerpt (простий текст), content (**Markdown**, D25: API не парсить — лише довжина; рендер — `packages/ui`), `coverImageAlt` (опис фото мовою перекладу, D44) · `Tag` / `TagTranslation` / `PostTag` · `PostCompetition`, `PostClub` (новини турніру / клубу)
- **Engagement:** `CommentThread` — рівно одна ціль (`postId?` | `matchId?`, CHECK), `isLocked`, `commentCount` · `Comment` — threadId, authorId, parentId?, rootId?, depth, content, replyCount, likeCount, pinnedAt, deletedAt · `PostLike` / `CommentLike` / `MatchLike` — YouTube-style (LIKE/DISLIKE, only LIKE shown publicly) · `UserReactionActivity` (журнал реакцій)
- **Football:** `Area` · `Competition` (`type` LEAGUE|CUP, `isActive`, `sortOrder`) · `Season` (`label` «2025/26» / «2026», рівно один `isCurrent`) · `SeasonClub` (M:N клуб ↔ сезон) · `Club` (`kind` CLUB|NATIONAL, `slug` не змінюється) · `Match` (`kickoffAt`, `stage`, `groupName`, half-time, пенальті, `winner`) · `Standing` (`stage`, `groupName` `''` = без групи, `type`)
- **Sync:** id провайдера — лише в `*ExternalRef` (`payloadHash`), журнал / лок — `SyncRun`. FOOTBALL-таблиці про провайдерів не знають

## API Structure (NestJS)
All routes prefixed with `/api/v1/`. Swagger UI — `/api/docs` (JSON — `/api/docs-json`), на проді вимкнений. Контракт (D28, backend Rule 11): response DTO — `dto/<сутність>-response.dto.ts`, метод контролера повертає `Promise<XDto>` (схему бере CLI-плагін), помилки — `@throws {404} CODE` у JSDoc; спільне (помилка `default`, 400 валідації) — `src/openapi/openapi-document.ts`

### Auth — `src/auth/`
- `POST /auth/register` — public
- `POST /auth/login` — public, sets httpOnly cookies
- `POST /auth/login/admin` — public, лише ADMIN (403 `ADMIN_ONLY` до створення сесії); ліміт спроб спільний з `login`
- `POST /auth/refresh` — ротація refresh-сесії (409 `REFRESH_SUPERSEDED` — гонка вкладок)
- `POST /auth/logout` — без guard (читає refresh-cookie); `POST /auth/logout-all` — `@AuthRequired()`; `GET /auth/me` — гість без cookies → `200 { user: null }`, 401 лише з refresh-cookie
- Files: `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`; cookies з токенами — `AuthCookieService` (`auth-cookies.ts`, надає `AuthSessionsModule`)
- DTOs: `register.dto.ts`, `login.dto.ts`
- Guards: `guards/jwt-auth.guard.ts`, `guards/optional-jwt-auth.guard.ts`, `guards/roles.guard.ts`, `guards/roles.decorator.ts`; `current-user.decorator.ts`
- Strategy: `strategies/jwt.strategy.ts` — reads token from cookie `access_token`

### Posts — `src/posts/`
- **Живий пост** (`post-visibility.ts`, `livePostWhere`): `deletedAt IS NULL`, `status IN (PUBLISHED, SCHEDULED)`, `publishedAt <= now` — SCHEDULED виходить сам, без cron. Чернетки за slug → 404, лайк чернетки — 404. Стрічка й новина за номером — `publicPostWhere` (+ переклад default-мови; ним же фільтрує публічний список тегів)
- `GET /posts?page=1&limit=10&lang=en&tags=&competition=&club=` — public, живі, `publishedAt desc`; `limit` ≤ 50. Фільтри (D46, `post-feed-filter.ts`): slug-и через кому, ≤ 20 (`IsSlugList`); усередині фільтра — АБО, між — І; турнір — лише явна прив'язка `PostCompetition`; невідомий slug → порожньо (200), не той формат / повтор параметра → 400. Переклад розгорнуто в пост (`title`, `excerpt`, `coverImageAlt`) з fallback на default-мову + `resolvedLanguage`; невідомий `lang` → default
- `GET /posts/admin/all?page=&limit=&status=&search=` — ADMIN, сторінка `{ data, total, page, limit, totalPages }` (`limit` 20, ≤ 100; нові першими), усі крім видалених: рядок — `status`, `publishedAt`, `isLive`, `translations: [{ languageCode, title }]`. Правило — `admin-post-filter.ts` (D47): `status` — як бачить редактор (запланована, чия дата настала, — серед PUBLISHED), `search` — підрядок заголовка будь-якою мовою без регістру; `%` / `_` — як текст (`prisma/prisma-text-search.ts`: Prisma 7 `contains` їх не екранує)
- `GET /posts/admin/:id` — ADMIN, новина для форми (будь-який статус; видалена → 404 `POST_NOT_FOUND`): переклади з текстом, медіа, джерело; теги / турніри / клуби — чипи `AdminTagRefDto` / `CompetitionRefDto` / `ClubRefDto` (один формат з вибором у формі, D47; select-и — `ADMIN_TAG_REF_SELECT` (`tag.repository.ts`), `COMPETITION_REF_SELECT` і `CLUB_REF_SELECT` (`football/football-refs.ts`)). Маршрут `admin/all` оголошено раніше за `admin/:id`
- `GET /posts/:number?lang=en` — public, живий пост **за номером** (ціле 1…2³¹−1, інакше 400) + `content`, `coverImageCredit`, `sourceUrl`, `sourceName`, `availableLanguages`, `tags`, `competitions`, `clubs` (коментарі — окремо, `GET /comments/post/:postId`); `slug` у відповіді — канонічний (web робить 308)
- **Slug** (`post-slug.ts`, D24; транслітерація — спільний з тегами `slugify`, `common/slug.ts`): один на всі мови, з EN-заголовка; поки `publishedAt` порожній — іде за EN-заголовком, щойно дата є — лише явний `slug` у `POST` / `PUT` (`resolveUpdatedPostSlug`)
- `POST /posts` — **ADMIN only**, body: `{ translations: [{ languageCode, title, excerpt, content, coverImageAlt? }], slug?, status?, publishedAt?, coverImageUrl?, coverImageCredit?, videoUrl?, sourceUrl?, sourceName?, tagIds?, clubIds?, competitionIds? }`; переклад default-мови (`Language.isDefault`, en) обов'язковий, решта — опційні (D23; `findTranslationLanguagesError` — спільне з тегами, `languages/translation-languages.ts`); без `status` — DRAFT. Правила статусу / дати — `post-publication.ts` (`resolvePostPublication`)
- **Обкладинка** (`post-cover-image.ts`, `resolvePostCoverImage`, D44): PUBLISHED / SCHEDULED з обкладинкою — опис у кожному перекладі й підпис (інакше 400 `COVER_IMAGE_ALT_REQUIRED` / `COVER_IMAGE_CREDIT_REQUIRED`), чернетка — будь-яка; інша адреса фото чи без фото — наявні опис і підпис не лишаються (`coverImageTextToStore`), переклад вимкненою мовою опису не потребує
- **Джерело** (`post-source.ts`, `resolvePostSource`, D26): назва без адреси → 400 `SOURCE_URL_REQUIRED`; назва — про конкретну адресу (як опис фото, D44): інша адреса старої назви не успадковує, `sourceUrl: null` прибирає джерело цілком; «передане або наявне» для правил — `requestedOrCurrent` (`post-field-update.ts`)
- `PUT /posts/:id` — **ADMIN only**; переклади — upsert за мовою, масив зв'язків замінює повністю
- `DELETE /posts/:id` — ADMIN only, soft delete (sets deletedAt) → `{ id }`
- Files: `post.controller.ts`, сервіси за use case (D47) — `public-post.service.ts` (стрічка, новина за номером), `admin-post.service.ts` (список і новина для адмінки), `post-editor.service.ts` (створення, зміна, видалення); репозиторії — `public-post.repository.ts`, `admin-post.repository.ts` (читання адміном і записи); `post.module.ts`, `post-response.ts` (форма відповідей), `admin-post-filter.ts`, `post-publication.ts`, `post-slug.ts`, `post-cover-image.ts`, `post-source.ts`, `post-field-update.ts`, `post-visibility.ts`, `post-feed-filter.ts`
- DTOs: `post-fields.dto.ts` (спільні поля + `PostTranslationDto`), `create-post.dto.ts`, `update-post.dto.ts`, `list-posts-query.dto.ts`, `list-admin-posts-query.dto.ts`, `post-number-param.dto.ts`, `admin-post-response.dto.ts`

### Tags — `src/tags/` (D45)
- `GET /tags?lang=` — public: лише теги з новинами стрічки (`publicPostWhere`), за абеткою назви мовою запиту (`Intl.Collator`); `GET /tags/:slug?lang=` — public, будь-який тег (сторінка тегу), `TAG_NOT_FOUND`. Назва — мова запиту → EN → slug (`toPublicTag`; той самий `TagDto` — у тегах новини)
- ADMIN: `GET /tags/admin/all` (назви всіма мовами + `postCount` — будь-який статус, без видалених), `POST /tags` `{ translations: [{ languageCode, name }], slug? }` → `AdminTagDto`, `PUT /tags/:id` (upsert назв), `DELETE /tags/:id` — фізично, каскадом (`PostTag`)
- Slug — з EN-назви або явний, **не змінюється**; зайнятий → 409 `TAG_SLUG_TAKEN` (лише унікальний індекс, без SELECT), без латиниці й slug-а → 400 `TAG_SLUG_REQUIRED`. `UNKNOWN_TAG` перевіряють пости; тег видалили під час збереження новини (FK) → та сама 400 (`throwIfRelationVanished`)
- Files: `tag.controller.ts`, `tag.service.ts`, `tag.repository.ts` (`publicTagSelect` — і в постах), `tag-response.ts`, `tag.module.ts`; DTOs: `tag-response.dto.ts`, `tag-translation.dto.ts`, `create-tag.dto.ts`, `update-tag.dto.ts`, `tag-slug-param.dto.ts`

### Languages — `src/languages/`
- `LanguageService` — мови з таблиці `Language` (кеш 60 с): `chooseContentLanguage(lang)` → `{ requestedCode, defaultCode }`, `getContentLanguages()` → `{ defaultCode, activeCodes }`
- Переклади новин і назви тегів: мови при записі — `translation-languages.ts` (`findTranslationLanguagesError`), fallback при читанні — `translation-fallback.ts` (`pickTranslation`, `languageCodesToLoad`), поле `languageCode` — `dto/translation-fields.ts`

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

### Health — `src/health/` (D33)
- `GET /health` — public (хостинг, uptime-монітор): terminus ping БД, таймаут 3 с → 200 / 503, у відповіді лише статуси

### Football — `src/football/` (schema v5; рішення — `docs/decisions/v5-football.md`)
- **Корінь:** `football.module.ts`, `football.controller.ts`, `football.constants.ts`, `football-match-status.ts` (`IN_PLAY` = LIVE + PAUSED, LIVE-вікно, `FINAL_MATCH_STATUSES`), `football-competition-status.ts` (`isCompetitionInPlay` — турнір «у грі», D48; не для cron), `football-club-search.ts` (умова й порядок пошуку клубів), `football-matchday.util.ts` (тури: `(stage, matchday)` у лізі / ліга-фазі / групах, плей-оф — уся стадія, `matchday: null`), `dto/*`
- **`integration/`** — порт `football-provider.port.ts` (`FootballProvider`, DI-токен `FOOTBALL_PROVIDER`, нейтральні `Provider*`, `FootballProviderError`) + адаптер `football-data/` (`client` — **одна черга запитів на процес**, ≥ 6,5 с між стартами, 429 → `X-RequestCounter-Reset`; `mapper` — **єдине** місце, що знає формат football-data; `provider`). Синк `Fd*` не бачить
- **`persistence/`** — `FootballRepository` (публічні читання), `FootballAdminRepository` (читання для форми новини), `FootballSyncRepository` (записи синку), `ExternalRefRepository` (batch resolve `*ExternalRef`), `SyncRunRepository` (журнал + лок)
- **`sync/`** — `FootballSyncService` (повний синк турніру: **рівно 4 запити** — competition, teams, matches, standings — сезон фіксується з першого), `FootballLiveSyncService` (`live-touch` + LIVE-cron), `FootballLiveThrottleService` (інтервал через `SyncRun`), `FootballSyncWriter` (спільні кроки), `football.cron.ts` (повний — кожні 2 год; LIVE — 5 хв, якщо `FOOTBALL_LIVE_CRON_ENABLED=true`)
- **`query/`** — `FootballQueryService` (усе в межах сезону: `?season=2025-26` / `2026`, інакше `isCurrent`), `FootballAdminQueryService` (вибір турнірів і клубів у формі новини), `football-response.ts`, `football-standings.util.ts` (головна таблиця для дашборду)
- **Правила синку:** провайдерські поля пишуться лише при зміні `payloadHash` (дельта); editorial (`slug`, `type`, `isActive`, `sortOrder`) — ніколи; `Match` не видаляється, `likeCount` / `dislikeCount` синк не пише; спільні сутності без голого `upsert` (`Area`, `SeasonClub` — `createMany skipDuplicates`; клуб + ref — одна транзакція, P2002 → відкат і повторний resolve; P2002 вкладеного ref Prisma звітує як `modelName: "Club"`); матчі — чанки по 50 в порядку `matchId`; таблиця — `(stage, groupName, type)` атомарно під `Season FOR NO KEY UPDATE`
- **Лок:** `SyncRun` `RUNNING` (partial unique) — один на provider + scope + турнір; `tryStart` під advisory-локом; застарілий `RUNNING` (повний > 10 хв, LIVE > 3 хв) → `FAILED STALE`
- **football-data (перевірено на реальних відповідях):** `limit` / `offset` на матчах ігнорує; `fullTime` **містить** серію пенальті (маппер віднімає); `standings.group` для ліг — підпис («Matchday»), не група; standings EC 2024 → 404 (= «таблиці немає»), WC 2026 — одна таблиця `GROUP_STAGE` на 48 команд (групи — лише в `Match.groupName`); збірні не позначені — `NATIONAL` за турніром (WC, EC)
- `GET /football/leagues` (лише `isActive`, `sortOrder`), `…/leagues/:slug` (будь-який — архів), `…/:slug/dashboard` (`{ league, season, standingsTable, standings, fixtures }`; `standingsTable` — `{ stage, groupName }` таблиці в `standings` або `null`), `…/:slug/standings` (`[{ stage, groupName, type, rows }]`), `…/:slug/clubs`, `…/:slug/matches?season&stage&page&limit`, `…/:slug/fixtures` (тури `{ stage, matchday, matches }`), `GET /football/matches/:id` (+ `league`, `season`). Коди: `LEAGUE_NOT_FOUND`, `SEASON_NOT_FOUND`, `MATCH_NOT_FOUND`
- `GET /football/matches?from=&to=&league=PL,CL` — матчі за часом початку `[from, to)` у всіх турнірах: межі — ISO **з поясом** (день рахує клієнт у своєму поясі), ≤ 32 доби (`MATCH_RANGE_INVALID` / `MATCH_RANGE_TOO_LONG`, `query/football-match-range.ts`); без `league` — лише `isActive`, зі slug-ами — будь-які; ≤ 1000 рядків; `{ matches: [рядок матчу + league] }`. `@IsIsoDateTimeWithZone` — `common/validation/iso-date-time.decorator.ts` (і `publishedAt` поста)
- ADMIN, для форми новини (D48): `GET /football/leagues/admin/all` — усі турніри, і вимкнені (чип + `type`, `isActive`); `GET /football/clubs/admin/search?search=` — 2–100 символів, підрядок назви / короткої назви / коду без регістру або адреси (запит через `slugify`; кирилицю він відкидає); усі збіги (≤ 200) ранжує `rankClubSearchResults` — спершу початок поля, далі абетка, до 20; у клубу — `competitions` поточного сезону «у грі» (`isActive` + `isCurrent` + матчі попереду — не остаточні, з початком ≤ 30 днів тому, — або ≤ 30 днів від кінця сезону), одним запитом на всі клуби
- `POST /football/sync` — **ADMIN**, **202** + фон; body `{ competitionIds?: string[] }` — **наші slug-и** (без тіла — усі активні); невідомий → 400 `UNKNOWN_COMPETITION`, без ключа → 503 `FOOTBALL_PROVIDER_NOT_CONFIGURED`. `GET /football/sync-runs?limit=` — **ADMIN**
- `POST /football/live-touch` — публічний, ліміт 10 / хв на IP; приймається для матчу в LIVE-вікні (гра йде або `SCHEDULED` у `[−3 год, +15 хв]`), LIVE-синк турніру — не частіше 60 с; лише оновлює наявні матчі, `FINISHED` → оновити таблицю

### E2E — `apps/api/test/`
- `pnpm test:e2e [-- модуль]` (з кореня; там же `pnpm test`, `pnpm typecheck`, `pnpm db:migrate`, `pnpm db:seed`) — окрема схема `e2e` у dev-БД (потрібна жива Supabase); правила — `apps/api/test/CLAUDE.md`

## Frontend Structure (apps/web/src/)
- i18n: `proxy.ts` (next-intl + тимчасовий 308 `/ua/…` → `/uk/…`, прибрати в M3.1), `i18n/` (routing, request, navigation), `messages/en.json` / `uk.json`; для `Intl` / дат — `uk-UA` (`lib/i18n/content-lang.ts`)
- **Дати — лише** `useDateTimeFormat()` (`hooks/`) у клієнті / `formatDateTime(value, locale, timeZone, options)` (`lib/i18n/date-time.ts`) у RSC; **не** `toLocaleString` (пояс процесу → hydration mismatch). Пояс — у конфігу next-intl: `i18n/time-zone.ts` (cookie `tz`, валідація IANA, дефолт `Europe/Kyiv`) → `i18n/request.ts`; `providers/TimeZoneSync.tsx` пише пояс браузера в cookie і робить один `router.refresh()` (порівняння через `Intl`: `Europe/Kyiv` = `Europe/Kiev`). Через `cookies()` у конфігу **усі маршрути динамічні**
- Unit-тести — Vitest (`vitest.config.mts`, `*.test.ts` поруч з кодом; `pnpm --filter @football-portal/web test -- proxy`): `proxy.test.ts` (редирект `/ua`, мова з браузера), `messages/messages.test.ts` (ключі кожної мови = `en.json`)
- `app/layout.tsx` — лише `children`; `app/[locale]/layout.tsx` — `html` / `body`, `NextIntlClientProvider`, `QueryProviders`, Navbar
- 404 — **одна загальна** `app/not-found.tsx` (без навбару; `[locale]/not-found` і catch-all `[...rest]` свідомо не робимо): **сама рендерить `<html>` / `<body>`** (кореневий layout — лише `children`; інакше Next: «Missing <html> and <body> tags in the root layout»), фон — на обгортці `div.bg-gray-950` (правило `body` у `globals.css` поза шарами Tailwind перебиває утиліти на `body`), мова — `getLocale()`, назва — `title.absolute`. Шрифт — `app/fonts.ts` (спільний з `[locale]/layout.tsx`). Невідомий URL → повний SSR; кинутий `notFound()` сторінки — у SSR оболонка `__next_error__`, 404 малює клієнт (штатно для Next 16). Посилання на ще не існуючі сторінки — `prefetch={false}` (prefetch 404 у Chrome «не завершується»)
- `app/[locale]/matches/page.tsx` — матчі дня: `?date=YYYY-MM-DD` у поясі користувача (без нього — сьогодні) → межі `from` / `to` (`lib/i18n/zoned-date.ts`: `zonedDayRange`, `dayKeyInTimeZone`, `shiftDayKey`), `?league=`; prefetch ліг і матчів + `MatchesDayView` (групи за турнірами в порядку `sortOrder` — `lib/football/matches-page.ts`; `refetchInterval` 60 с, якщо є матч у грі; без `live-touch`). Компоненти — `components/football/matches/` (`MatchesDayNav`, `MatchesLeagueFilter`, `MatchesLeagueGroup`, `MatchListRow` — до 640 px команди одна під одною), `components/football/FootballClubCrest.tsx`; хук — `matchesInRangeQueryOptions` (`hooks/useFootball.ts`)
- `app/[locale]/page.tsx` — RSC: ліга сайдбару — `?league=` (`lib/football/league-param.ts`) або за замовчуванням (`resolveDefaultLeagueSlug`: env, якщо ліга активна, інакше перша за `sortOrder`); `fetchQuery` ліг + prefetch постів і дашборду; **один `HydrationBoundary` на всю сітку** (`FootballSidebar` + `HomeFeed`) — сайдбар у SSR з даними
- `app/[locale]/matches/[id]/` — матч (`fetchQuery` + `HydrationBoundary`, `MatchDetailView`; невідомий id → `notFound()`, HTTP 404; назва у вкладці «Господарі – Гості · Ліга» — `generateMetadata` і сторінка ділять `cache(fetchMatchDetail)`; «Усі матчі {дата}» → `/matches?date=`); незавершений (не FINISHED / CANCELLED / AWARDED / POSTPONED) → `POST /football/live-touch` (LIVE-вікно перевіряє API); у грі (LIVE / PAUSED) — refetch кожні 45 с; серія пенальті — окремим рядком; стадія / тур / група в шапці; «На головну» → `/?league=<ліга матчу>`
- `components/football/FootballSidebar.tsx` — перемикач `sidebar/FootballLeagueSwitcher.tsx` (групи «Ліги» / «Кубки» за `type`, посилання `?league=`), таблиця (заголовок за `standingsTable`), тури; `hooks/useSelectedLeague.ts` (`?league=` ↔ `history.pushState` — без серверного рендеру), `hooks/useFootballStageLabels.ts` (стадії / групи кубків), `hooks/useFootball.ts`, `hooks/useMatchStatusLabel.ts` (підпис статусу, `isMatchInPlay` / `isMatchTerminal`)
- `components/layout/LocaleSwitcher.tsx` — зміна мови зберігає query (`?league=`); до 1024 px — `Eng` / `Укр` (`locale.short.*`, як в адмінці). Навбар (`Navbar` / `NavbarClient`) без виходу за екран 320…1280 px: до 640 px — лише ⚽ і «Увійти», ім'я — від 1024 px; бургер-меню — з етапом 7.1
- `app/[locale]/news/[slugAndNumber]/page.tsx` — RSC: сегмент `{slug}-{number}` → `parsePostPathSegment` (`lib/news/post-path.ts`; номер — цифри після останнього дефіса, поза INTEGER → 404); `generateMetadata` і сторінка ділять `cache(fetchPostDetail)`; `fetchQuery` + `HydrationBoundary`; неканонічний slug → 308 (`permanentRedirect` з `i18n/navigation`); `NewsPostView.tsx` (`useQuery`; рядок «Джерело: …» — `PostSourceLine.tsx`, назва або домен — `postSourceLink`, `lib/news/post-source.ts`). Посилання на новину — `postPathSegment(post)`
- `app/[locale]/news/[slugAndNumber]/CommentSection.tsx` — `useComments` / `useCreateComment` / `useDeleteComment`; вузол дерева — `components/comments/CommentThreadNode.tsx`; лайки — `components/features/LikeBar.tsx` + `hooks/useLikes.ts` (новина, коментарі, матч)
- `app/[locale]/auth/login`, `…/auth/register` — форми (React Hook Form + zod-схеми з `@football-portal/validation/forms`)
- `hooks/usePosts.ts`, `usePostDetail.ts`, `useComments.ts`, `hooks/useAuth.ts` — `useAuthQuery` (`GET /auth/me`, ключ `['auth','me']`, гість — `null`) + мутації логін/реєстрація/logout (пишуть у кеш `me`); `useAuthorDisplayName` — «Видалений користувач» за `author.isDeleted`
- `lib/api/http.ts` — `apiGet` / `apiPost` / `apiPut` / `apiDelete(url, body?)` (credentials, JSON); **єдиний HTTP-шар**. Помилки — `ApiError { status, code, retryAfterSeconds }`. На 401 (лише в браузері; не для `/auth/login|register|refresh|logout`) — один single-flight `POST /auth/refresh` і повтор запиту; 409 від refresh = успіх (інша вкладка); лише 401/403 від refresh = вихід (`onSessionExpired`); 429 / мережа — не розлогінюють
- `lib/api/types.ts` — ре-експорт `@football-portal/types` (`PaginatedPosts`, `PostDetail`, `Comment`, `DEFAULT_CONTENT_LANG` …; fallback перекладу робить API; `resolvedLanguage` ≠ мові сторінки → позначка «Переклад недоступний»)
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `providers/AuthSessionSync.tsx` — дзеркалить `useAuthQuery` у store, реагує на `onSessionExpired`
- `store/auth.store.ts` — Zustand, `user: User | null`, `isLoading` (read-model; писати лише через `AuthSessionSync`)

## Admin Structure (apps/admin/src/)
- `app/layout.tsx` — `QueryProviders`
- `app/dashboard/layout.tsx` — `AdminShellBar` (навігація, публічний сайт з `NEXT_PUBLIC_PUBLIC_WEB_URL`, **Вийти** → `POST /auth/logout`)
- `app/dashboard/page.tsx` — картка **Football data** + `FootballSyncButton` → `POST /football/sync`; **Журнал синків** — `SyncRunsTable` / `useSyncRuns` (`GET /football/sync-runs`, автооновлення, поки є `RUNNING`)
- `lib/publicWebUrl.ts`, `hooks/useAdminLogout.ts`, `hooks/useAdminSessionExpiry.ts` (refresh відхилено → `/login`)
- `app/login/AdminLoginForm.tsx` — `useAdminLogin` (mutation, `POST /auth/login/admin`)
- `app/dashboard/posts/page.tsx` — клієнтська сторінка, `useAdminPosts(page)` (сторінки по 20, «Newer / Older»); посилання «View on site» (`/news/{slug}-{number}`) через `NEXT_PUBLIC_PUBLIC_WEB_URL` (fallback `http://localhost:3000`)
- `app/dashboard/posts/create/CreatePostForm.tsx` — `useCreatePost`, тіло `CreatePostDto` (EN обов'язково, UK опційно — публікація без UK лише з попередженням; статус Draft / Publish now / Schedule + дата); схема форми й тіло запиту — `createPostFormSchema.ts`, обкладинка — `CoverImageFields.tsx` (опис EN / UK і підпис — обов'язкові для публікації з фото, як в API)
- `hooks/useAdminPosts.ts`, `useCreatePost.ts`, `useAdminLogin.ts`
- `lib/api/http.ts` (та сама refresh-логіка, що й у web — міняти разом), `lib/api/types.ts` — згенеровані типи (`AdminPost`, `CreatePostRequest`, `SyncRun`) + підписи `adminPostTitle`, `adminAuthorName`
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `store/auth.store.ts`

## Rules (обовʼязкові)
Повні правила з прикладами — `docs/rules/` (нові позначені ⭐). Підключені нижче, тож діють у кожній сесії:

@docs/rules/clean-code.md
@docs/rules/backend.md
@docs/rules/frontend.md
@docs/rules/security.md
@docs/rules/code-style.md
@docs/rules/process.md
@docs/rules/content.md

## Environment Variables
Повний перелік із поясненнями — `apps/api/.env.example`, `apps/web/.env.example`, `apps/admin/.env.example` (скопіювати в `.env` / `.env.local`; ці файли — не в git).
### apps/api/.env — схема `src/config/env.schema.ts` (zod, M1.3.2)
- Перевіряється при старті (`config/env.config.ts`: `registerAs` + `ConfigModule.forRoot({ ignoreEnvFile, load })`): немає обов'язкової або значення невалідне → API не стартує й перелічує всі проблеми (без значень); `KEY=` без значення = змінної немає
- У коді — лише `@Inject(envConfig.KEY) env: AppEnv`; `process.env` у `src/` поза `config/env.config.ts` забороняє ESLint (Rule 13). `.env` завантажує `main.ts` (dotenv), а не `ConfigModule` — e2e не підхопить dev-БД випадково
- Обов'язкові: `NODE_ENV` (development | production | test), `DATABASE_URL` (транзакційний пулер :6543), `JWT_SECRET` і `EMAIL_HASH_SECRET` (≥ 32 символи, різні; HMAC — НЕ змінювати після запуску), `CORS_ORIGINS` (рівно origin-и через кому; на проді лише https); на проді ще `TRUST_PROXY` (кількість проксі, напр. 1, або 0 / false; `true` заборонено)
- Опційні (дефолт): `PORT` (4000), `FOOTBALL_API_KEY` (без нього синк → 503), `FOOTBALL_API_URL` (football-data v4, лише https), `FOOTBALL_LIVE_CRON_ENABLED` (false), `FOOTBALL_HTTP_LOG` (true лише в development; явне значення перемагає), `COMMENT_COOLDOWN_MS` (60000, ≤ 24 год — retention `RateLimitEvent`)
- Лише CLI (у схемі немає): `DIRECT_URL` (session-пулер / пряме з'єднання :5432 — `prisma migrate`, seed; порожньо → `DATABASE_URL`), `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` (`pnpm db:seed` без `seed-data/content.json`). Турніри для синку — з `Competition.isActive`, не з env
### apps/web/.env.local, apps/admin/.env.local
`NEXT_PUBLIC_*` — вбудовуються в JS при збірці (секретів не буває); без файлу — дефолти localhost. Web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG` (як `Competition.slug`; немає / неактивна — перша активна за `sortOrder`), `NEXT_PUBLIC_ADMIN_URL`. Admin: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PUBLIC_WEB_URL`

## Current Status
Документація — `docs/` (карта — `docs/README.md`): **план** — `docs/football-plan.md` (віхи M1–M4, етапи з чекбоксами, Definition of Done, повний чекліст зробленого), **рішення** — `docs/decisions/` (D1–D20, P2-* … P5b-*, R*, «🧭 п. N» — з тими самими ID, що в коментарях коду; нові — D21+), **правила** — `docs/rules/`, архітектура — `docs/architecture.md`, відкладене / ідеї / питання — `docs/backlog.md`, `docs/ideas.md`, `docs/open-questions.md`; старі плани — `docs/archive/` (історія, не план). Позначки в плані: 👤 рішення власника · ⭐ рекомендація · ❓ уточнити перед виконанням · ⚠️ розбіжність з кодом.

**Зроблено:** M0 — схема v5 і все на ній (auth, модерація, контент, коментарі, лайки, football-синк, web, admin) — повний чекліст у плані, розділ 11.

**Зараз — M1 «Тестовий реліз»**, по черзі: M1.1 документація (правила підключено нижче; власник дочитує `docs/rules/`) → M1.2 мова `uk` скрізь → M1.3 інфраструктурний мінімум (ESLint адмінки, `/health`, `@CurrentUser()`, strict TS, Swagger + `openapi-typescript`) → M1.4–M1.6 новини (API, адмінка, web: URL `{slug}-{номер}`, Markdown, джерела, теги, фільтри) → M1.7 коментарі як на YouTube → M1.8 SEO-база → M1.9 UI-мінімум → M1.10 CI → M1.11 тестовий деплой (закритий, `noindex`).

**Процес** (`docs/rules/process.md`): гілку етапу створює AI (від `origin/master`, `--no-track`); коміти, push і PR — лише власник, AI в кінці етапу пропонує назву (Conventional Commits) і підсумок, оновлює план і дає передачу для нового діалогу.
