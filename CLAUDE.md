# Football Portal — Project Context

## Stack
- **Web** (port 3000): Next.js 16, React 19, Tailwind 4, React Hook Form + Zod, Zustand, **TanStack Query** (`prefetchQuery` + `HydrationBoundary` для головної та новини; хуки для коментарів і auth)
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
- Пароль: новий ≥ 8 (межі — `packages/validation`); логін — без мінімуму (старі акаунти)

## Database (Prisma schema v4.0)
Key models:
- `User` — id, email (always lowercase), password (bcrypt), name, role, avatar, bio
- `Post` — id, slug, coverImage, videoUrl, published, sourceUrl, authorId, deletedAt (soft delete)
- `PostTranslation` — postId, language ('en'|'ua'), title, excerpt, content — i18n
- `PostTag` / `Tag` — many-to-many tags
- `Comment` — content, authorId, postId?, matchId?, parentId? (replies), pinnedAt, deletedAt
- `PostLike` / `CommentLike` / `MatchLike` — YouTube-style likes (LIKE/DISLIKE, only LIKE shown publicly)
- `League` / `Club` / `Match` / `LeagueTable` — football data with externalId for API sync

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
- `GET /comments/post/:postId` — public
- `GET /comments/match/:matchId` — public
- `POST /comments` — authenticated, body: `{ content, postId?, matchId?, parentId? }`
- `DELETE /comments/:id` — author or ADMIN (soft delete)
- Files: `comment.controller.ts`, `comment.service.ts`, `comment.repository.ts`, `comment.module.ts`

### Football — `src/football/` (етап 4.3 + підмодулі)
- **Корінь:** `football.module.ts`, `football.controller.ts`, `football.constants.ts`, `football-matchday.util.ts`, `football-standings.util.ts`, `dto/*`
- **`integration/`** — зовнішнє API: `football-data.client.ts`, `football.mapper.ts`; `FootballIntegrationModule`
- **`persistence/`** — `FootballRepository`; `FootballPersistenceModule`
- **`query/`** — `FootballQueryService` (GET з БД); `FootballQueryModule`
- **`sync/`** — `FootballSyncService`, `football-live-throttle.service.ts`, `football.cron.ts`; `FootballSyncModule`
- `GET …/dashboard` — таблиця + fixtures одним запитом (web)
- `POST /football/sync` — **ADMIN**, **202** + фон; body `{ competitionIds?: string[] }`
- `POST /football/live-touch`, cron — як у README

## Frontend Structure (apps/web/src/)
- `app/layout.tsx` — Navbar, `QueryProviders`
- `app/page.tsx` — RSC: prefetch постів + `leagueDashboardQueryOptions`; сітка: `FootballSidebar` + `HomeFeed`
- `app/matches/[id]/` — матч; LIVE: `POST /football/live-touch` + refetch кожні 45 с
- `components/football/FootballSidebar.tsx`, `hooks/useFootball.ts`
- `app/news/[slug]/page.tsx` — RSC: `generateMetadata` через `apiGet`; `prefetchQuery(postDetailQueryOptions)` + `HydrationBoundary`; `NewsPostView.tsx` (`useQuery`)
- `app/news/[slug]/CommentSection.tsx` — `useComments` / `useCreateComment` / `useDeleteComment`
- `hooks/usePosts.ts`, `usePostDetail.ts`, `useComments.ts`, `hooks/useAuth.ts` — `useAuthQuery` (`GET /auth/me`, ключ `['auth','me']`, 401 → `null`) + мутації логін/реєстрація/logout (пишуть у кеш `me`); `useAuthorDisplayName` — «Видалений користувач» за `author.isDeleted`
- `lib/api/http.ts` — `apiGet` / `apiPost` / `apiPut` / `apiDelete(url, body?)` (credentials, JSON); **єдиний HTTP-шар**. Помилки — `ApiError { status, code, retryAfterSeconds }`. На 401 (лише в браузері; не для `/auth/login|register|refresh|logout`) — один single-flight `POST /auth/refresh` і повтор запиту; 409 від refresh = успіх (інша вкладка); лише 401/403 від refresh = вихід (`onSessionExpired`); 429 / мережа — не розлогінюють
- `lib/api/types.ts` — `Post`, `PostDetail`, `Comment`, `DEFAULT_CONTENT_LANG` (fallback перекладу робить API; `resolvedLanguage` ≠ мові сторінки → позначка «Переклад недоступний»)
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `providers/AuthSessionSync.tsx` — дзеркалить `useAuthQuery` у store, реагує на `onSessionExpired`
- `store/auth.store.ts` — Zustand, `user: User | null`, `isLoading` (read-model; писати лише через `AuthSessionSync`)

## Admin Structure (apps/admin/src/)
- `app/layout.tsx` — `QueryProviders`
- `app/dashboard/layout.tsx` — `AdminShellBar` (навігація, публічний сайт з `NEXT_PUBLIC_PUBLIC_WEB_URL`, **Вийти** → `POST /auth/logout`)
- `app/dashboard/page.tsx` — картка **Football data** + `FootballSyncButton` → `POST /football/sync`
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
6. **Soft delete** — Post and Comment use `deletedAt`, never hard delete
7. **Email** — always `toLowerCase().trim()` before saving
8. **i18n** — content in PostTranslation, always pass `lang` param to queries
9. **Likes** — separate tables (PostLike/CommentLike/MatchLike), DISLIKE stored but not shown publicly
10. **Security** — DOMPurify on frontend, Helmet + CORS + ValidationPipe on backend
11. **Іменування** — у бізнес-коді та утилітах уникати одно- та дволітерних імен змінних/параметрів; мінімум **3 символи**, окрім загальноприйнятих: `id`, `url`, `err` у дуже вузькому контексті, індекси циклу `i`/`j` лише якщо немає семантики. Для зовнішніх DTO допускається префікс **`Fd`** (football-data.org) у типах мапера. Назви мають відображати **роль значення** (`matchFromApi`, `encodedCompetitionRef`, `clubIdByExternalTeamId`), а не форму (`map`, `row`). Детальніше: `.cursor/rules/naming-readability.mdc`.

## Environment Variables
### apps/api/.env
```
DATABASE_URL=...
JWT_SECRET=... (обов'язковий, ≥ 32 символи, випадковий — інакше API не стартує; HS256 для access-JWT)
JWT_REFRESH_SECRET=... (не використовується з Фази 2b — прибрати у Фазі 6)
PORT=4000
FOOTBALL_API_KEY=... (API Token з кабінету, НЕ id змагання)
FOOTBALL_API_URL=https://api.football-data.org/v4
FOOTBALL_COMPETITION_IDS=PL
FOOTBALL_LIVE_CRON_ENABLED=false
FOOTBALL_HTTP_LOG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001 (обов'язковий; через кому, рівно origin — без шляху і `/`; на проді лише https)
EMAIL_HASH_SECRET=... (обов'язковий, ≥ 32 символи, випадковий; HMAC блоклиста пошт видалених акаунтів — НЕ змінювати після запуску)
TRUST_PROXY= (порожньо в dev; на проді ОБОВ'ЯЗКОВИЙ — кількість проксі, напр. 1, або 0/false без проксі; `true` заборонено)
```
(`FOOTBALL_HTTP_LOG` — логувати всі запити до football-data; у dev це вмикається автоматично)
### apps/web/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG=PL
# як у League.slug (код змагання, напр. PL)
```
### apps/admin/.env.local (рекомендовано)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_PUBLIC_WEB_URL=http://localhost:3000
```

## Current Status
**Completed:**
- Monorepo, NestJS API (posts з translations, comments, auth)
- **Етап 4.1:** Prisma схема v4.0 (у т.ч. `League` / `Club` / `Match` / `LeagueTable` з `externalId` для синку)
- **Етап 4.2:** Post API + web + admin під translations, `lang`, коментарі з `matchId?` / `parentId?`
- **Етап 4.3:** API + web сайдбар (таблиця, тури), сторінка `/matches/[id]`, адмін-кнопка синку; LIVE on-demand + опційний cron
- Web: TanStack Query + `http.ts`; головна та новина з prefetch/hydrate; коментарі та auth через mutations
- Admin: TanStack Query; список постів і створення з `translations`; логін через mutation
- Web: відновлення сесії після F5 (`GET /auth/me` + `useAuthQuery`); web + admin: refresh-on-401 (Фаза 2e). Admin `/auth/me` не викликає — сесію перевіряє API (401 → refresh → `/login`)

**In progress / polish:**
- Коментарі до матчів у UI, DOMPurify

**Next up:**
- Коментарі на сторінці матчу, лайки (етап 5), профілі, теги в публічному UI
