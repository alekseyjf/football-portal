# Football Portal — Project Context

## Stack
- **Web** (port 3000): Next.js 16, React 19, Tailwind 4, React Hook Form + Zod, Zustand, **TanStack Query** (`prefetchQuery` + `HydrationBoundary` для головної та новини; хуки для коментарів і auth)
- **Admin** (port 3001): Next.js 16, React Hook Form + Zod, Zustand, **TanStack Query** (пости, логін, створення поста)
- **API** (port 4000): NestJS, Prisma 7, PostgreSQL (Supabase), JWT httpOnly cookies
- **Monorepo**: pnpm + Turborepo
- `packages/types` — shared TypeScript types
- `packages/config` — shared tsconfig, eslint

## Auth
- JWT: access token 15min + refresh token 7d, stored in **httpOnly cookies**
- Roles: `ADMIN`, `USER`
- Guards: `JwtAuthGuard`, `RolesGuard`, `@Roles('ADMIN')` decorator
- Login only via admin panel (port 3001) — cookies are shared on localhost

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
- `POST /auth/logout` — protected (JwtAuthGuard)
- Files: `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- DTOs: `register.dto.ts`, `login.dto.ts`
- Guards: `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts`, `guards/roles.decorator.ts`
- Strategy: `strategies/jwt.strategy.ts` — reads token from cookie `access_token`

### Posts — `src/posts/`
- `GET /posts?page=1&limit=10&lang=en` — public, paginated
- `GET /posts/admin/all?lang=en` — ADMIN only
- `GET /posts/:slug?lang=en` — public, post + translations + nested comments/replies
- `POST /posts` — **ADMIN only**, body: `{ translations: [{language, title, excerpt, content}], published?, coverImage?, tagIds? }` — **створення лише з адмінки**
- `PUT /posts/:id` — author or ADMIN
- `DELETE /posts/:id` — ADMIN only, soft delete (sets deletedAt)
- Files: `post.controller.ts`, `post.service.ts`, `post.repository.ts`, `post.module.ts`
- DTOs: `create-post.dto.ts` (with `PostTranslationDto`), `update-post.dto.ts`

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
- `hooks/usePosts.ts`, `usePostDetail.ts`, `useComments.ts`, `hooks/useAuth.ts` — мутації логін/реєстрація/logout
- `lib/api/http.ts` — `apiGet` / `apiPost` / `apiPut` / `apiDelete` (credentials, JSON); **єдиний HTTP-шар**
- `lib/api/types.ts` — `Post`, `PostDetail`, `Comment`, `getTranslation`, `DEFAULT_CONTENT_LANG`
- `lib/query/queryClient.ts`, `providers/QueryProvider.tsx`
- `store/auth.store.ts` — Zustand, `user: User | null`

## Admin Structure (apps/admin/src/)
- `app/layout.tsx` — `QueryProviders`
- `app/dashboard/layout.tsx` — `AdminShellBar` (навігація, публічний сайт з `NEXT_PUBLIC_PUBLIC_WEB_URL`, **Вийти** → `POST /auth/logout`)
- `app/dashboard/page.tsx` — картка **Football data** + `FootballSyncButton` → `POST /football/sync`
- `lib/publicWebUrl.ts`, `hooks/useAdminLogout.ts`
- `app/login/AdminLoginForm.tsx` — `useAdminLogin` (mutation)
- `app/dashboard/posts/page.tsx` — клієнтська сторінка, `useAdminPosts`; посилання «View on site» через `NEXT_PUBLIC_PUBLIC_WEB_URL` (fallback `http://localhost:3000`)
- `app/dashboard/posts/create/CreatePostForm.tsx` — `useCreatePost`, тіло `CreatePostDto` (EN обов'язково, UA опційно)
- `hooks/useAdminPosts.ts`, `useCreatePost.ts`, `useAdminLogin.ts`
- `lib/api/http.ts`, `lib/api/types.ts` — `AdminPostRow`, `CreatePostPayload`, `adminPostTitle`
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
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PORT=4000
FOOTBALL_API_KEY=... (API Token з кабінету, НЕ id змагання)
FOOTBALL_API_URL=https://api.football-data.org/v4
FOOTBALL_COMPETITION_IDS=PL
FOOTBALL_LIVE_CRON_ENABLED=false
FOOTBALL_HTTP_LOG=true
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

**In progress / polish:**
- `GET /auth/me` + `useAuthQuery` для відновлення сесії після F5
- Коментарі до матчів у UI, DOMPurify

**Next up:**
- Коментарі на сторінці матчу, лайки (етап 5), профілі, теги в публічному UI
