# ⚽ Football Portal — Master Plan & Rules

> **Версія плану:** 4.4 (локалі лише `en`/`ua`; Accept-Language ISO `uk*` → `ua` у proxy; football — підмодулі Nest)
> **Автор:** Олексій
> **Останнє оновлення:** Квітень 2026

---

# ЧАСТИНА 1 — ПРАВИЛА ПРОЕКТУ

> Підхід: **Senior Full-Stack Architect**.
> Кожне рішення приймається з урахуванням масштабування, безпеки і підтримки.
> Правило №1: найдорожча річ у backend — це зміна схеми після запуску.

---

## 🏛️ Архітектурні правила (Backend)

### Clean Architecture Light — структура кожного модуля
```
module/
  module.controller.ts   ← ТІЛЬКИ роутинг. Прийняв → передав → повернув
  module.service.ts      ← ТІЛЬКИ бізнес-логіка (use cases)
  module.repository.ts   ← ТІЛЬКИ Prisma запити
  module.mapper.ts       ← ТІЛЬКИ трансформація зовнішніх даних (якщо є)
  dto/
    create-X.dto.ts
    update-X.dto.ts
    response-X.dto.ts
```

**Rule 1 — Controller тупий**
```typescript
@Post()
create(@Body() dto: CreatePostDto, @Req() req: Request) {
  return this.postService.createPost(dto, req.user.id);
  // Більше нічого. Жодної логіки.
}
```

**Rule 2 — Service = Use Cases (описові імена)**
```typescript
// ✅ createPost, publishPost, getPostBySlug, syncLeagueStandings
// ❌ handlePost, processData, doStuff
```

**Rule 3 — Repository ховає Prisma**
```typescript
// ✅ await this.postRepository.findBySlug(slug)
// ❌ this.prisma.post.findUnique(...) напряму в сервісі
```

**Rule 4 — Mapper для зовнішніх API**
```typescript
// football.mapper.ts — єдине місце де знають про структуру зовнішнього API
// Якщо API зміниться → міняємо тільки mapper, решта коду не знає про API
```

**Rule 5 — DTO скрізь**
```typescript
// Вхідні дані → DTO з валідацією (class-validator)
// Вихідні дані → select{} в Prisma (ніколи не повертати зайве)
// DTO ≠ Entity: DTO для API, Entity для бізнес-логіки
```

**Rule 6 — select замість include**
```typescript
// Завжди явно вказувати які поля повертати
// Ніколи не повертати password, навіть випадково через join
select: { id: true, email: true, name: true } // ✅
include: { author: true }                      // ❌ може потягнути зайве
```

**Rule 7 — Soft Delete для модерованого контенту**
```typescript
// Post і Comment мають deletedAt DateTime?
// "Видалення" = встановити deletedAt, не DELETE з БД
// Запити фільтрують: where: { deletedAt: null }
```

**Rule 8 — Email завжди lowercase**
```typescript
// В сервісі перед збереженням:
email = dto.email.toLowerCase().trim();
```

**Rule 9 — i18n через Translation таблиці**
```typescript
// Контент (title, excerpt, content) → PostTranslation
// Мета-дані (slug, coverImage, published) → Post
// Запит завжди з мовою: where: { language: 'en' }
```

---

## ⚛️ Архітектурні правила (Frontend)

**Rule 1 — Server Component за замовчуванням**
```typescript
// Якщо немає useState/useEffect/onClick → Server Component
// "use client" тільки для інтерактивних компонентів
```

**Rule 2 — HTTP лише через `lib/api/http.ts`; дані в клієнті — через TanStack Query**
```typescript
// ✅ queryFn: () => apiGet('/posts') у useQuery / prefetchQuery
// ✅ мутації: apiPost / apiDelete у useMutation
// ✅ generateMetadata (RSC): apiGet напряму — без React Query
// ❌ fetch('http://localhost:4000/...') з хардкодом URL у компоненті
```

**Rule 3 — Компонент < 200 рядків**
```typescript
// Якщо більше → розбити на менші або винести логіку в хук
```

**Rule 4 — Логіка у хуки**
```typescript
// hooks/useComments.ts, hooks/useLikes.ts
// Компонент рендерить, хук думає
```

**Rule 5 — Форми через React Hook Form + Zod**
```typescript
// Zod схема → тип автоматично через z.infer<typeof schema>
// Ніяких useState для кожного поля форми
```

**Rule 6 — Locale передається через URL**
```typescript
// /en/news/[slug]
// /ua/news/[slug]
// next-intl middleware визначає мову
```

---

## 🔐 Правила безпеки (Security Rules)

**Backend (цільовий набір):**
- `class-validator` у ВСІХ DTO — обов'язково
- `Helmet` — security headers (додати в `main.ts`, зараз у репозиторії **немає**)
- `CORS` — явно вказані origins + `credentials: true` (**є** у `main.ts`)
- Rate limiting — `@nestjs/throttler` на `/auth/*` (у плані з початку; у коді **поки не підключено**)
- Паролі — bcrypt, saltRounds = 10
- JWT — access 15хв + refresh 7д, httpOnly cookies, `sameSite: 'lax'` (**є**)
- Ніколи не повертати `password` у відповіді API
- `whitelist: true` у ValidationPipe — видаляє зайві поля (**є**)
- Email — завжди toLowerCase() перед збереженням (**є** в auth)

**CSRF (окремо від JWT у cookie):**  
Куки з `SameSite=Lax` вже зменшують класичний CSRF з чужого сайту. Для **defence in depth** перед продакшеном варто додати перевірку для мутацій (заголовок + секрет у cookie або double-submit). Пакет **`csurf` застарілий** — при імплементації краще дивитись на актуальні підходи для Express/Nest 11 (власний middleware, `@edge-csrf/*`, або політика тільки для same-site API + суворий CORS). Не плутати з **Next.js**: подвійний домен (web 3000, api 4000) — це cross-origin; CSRF-токен має видавати API і фронт передає його в заголовку на мутації.

**Frontend:**
- `DOMPurify` для будь-якого user-generated HTML
- Ніколи `dangerouslySetInnerHTML` без санітизації
- Токени — тільки httpOnly cookies, ніколи localStorage
- Env змінні — публічні тільки з `NEXT_PUBLIC_`

**XSS Prevention:**
```typescript
// ✅ ПРАВИЛЬНО
const clean = DOMPurify.sanitize(userContent);
<div dangerouslySetInnerHTML={{ __html: clean }} />

// ❌ ЗАБОРОНЕНО
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

---

## 🎨 Правила коду (Style Guide)

**TypeScript:**
- `strict: true` у всіх tsconfig
- Ніяких `any` → використовуй `unknown` або явний тип
- Shared типи у `packages/types`

**Іменування:**
- Компоненти/Класи → `PascalCase`
- Функції/змінні → `camelCase`
- Константи → `SCREAMING_SNAKE_CASE`
- Файли компонентів → `PostCard.tsx`, `MatchTable.tsx`

**Git:**
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Коміт кожен день
- PR не мержити без успішного CI

---

## ⚡ Dev Rules (щоб не вигоріти)

- ❗ **Один день = один видимий результат**
- ❗ **Одна фіча за раз**
- ❗ **Застряг > 1 год → спрощуєш або питаєш у AI**
- ❗ **Не робити ідеально на MVP — спочатку працює, потім красиво**
- ❗ **Коміт кожен день**

---

# ЧАСТИНА 2 — СХЕМА БД (Senior Ready v4.0)

## 🗄️ Повна Prisma схема

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────
// ENUMS
// ─────────────────────────────

enum Role        { USER ADMIN }
enum MatchStatus { SCHEDULED LIVE FINISHED POSTPONED CANCELLED }
enum LikeType    { LIKE DISLIKE }
// У реальному `apps/api/prisma/schema.prisma` — саме так (без поліморфної Like)

// ─────────────────────────────
// USER
// ─────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique          // завжди зберігати lowercase в коді
  password  String
  name      String
  role      Role     @default(USER)
  avatar    String?
  bio       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts        Post[]
  comments     Comment[]
  postLikes    PostLike[]
  commentLikes CommentLike[]
  matchLikes   MatchLike[]
}

// ─────────────────────────────
// POSTS + i18n
// ─────────────────────────────

model Post {
  id         String    @id @default(cuid())
  slug       String    @unique
  coverImage String?
  videoUrl   String?   // для відео оглядів матчів
  published  Boolean   @default(false)
  sourceUrl  String?   // джерело для AI-парсингу новин
  authorId   String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  deletedAt  DateTime? // soft delete — модерація

  author       User              @relation(fields: [authorId], references: [id])
  comments     Comment[]
  likes        PostLike[]
  tags         PostTag[]
  translations PostTranslation[]

  @@index([createdAt])
  @@index([authorId])
  @@index([published])
}

// Контент поста розділений по мовах
// Якщо додаємо нову мову → просто новий рядок, схема не міняється
model PostTranslation {
  id       String @id @default(cuid())
  language String // 'en', 'ua'
  title    String
  excerpt  String
  content  String
  postId   String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([postId, language])
}

// ─────────────────────────────
// TAGS
// ─────────────────────────────

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique
  slug  String    @unique
  posts PostTag[]
}

model PostTag {
  postId String
  tagId  String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
}

// ─────────────────────────────
// COMMENTS
// ─────────────────────────────

model Comment {
  id        String    @id @default(cuid())
  content   String
  authorId  String
  postId    String?   // прив'язка до поста (опціонально)
  matchId   String?   // прив'язка до матчу (опціонально)
  parentId  String?   // для відповідей на коментарі
  pinnedAt  DateTime? // закріплення (YouTube-стиль)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft delete — модерація

  author  User      @relation(fields: [authorId], references: [id])
  post    Post?     @relation(fields: [postId], references: [id], onDelete: Cascade)
  match   Match?    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  parent  Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies Comment[] @relation("CommentReplies")
  likes   CommentLike[]

  @@index([createdAt])
  @@index([postId])
  @@index([matchId])
  @@index([postId, pinnedAt])
  @@index([matchId, pinnedAt])
}

// ─────────────────────────────
// LIKES — три окремі таблиці (замість поліморфної)
// Причина: Prisma не підтримує поліморфні FK через targetId+enum
// Семантика YouTube: LIKE/DISLIKE, публічно показуємо тільки LIKE
// @@unique = один голос на користувача на об'єкт
// onDelete: Cascade = видалення поста/коменту → видаляються лайки
// ─────────────────────────────

model PostLike {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  type      LikeType @default(LIKE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@index([postId])
}

model CommentLike {
  id        String   @id @default(cuid())
  userId    String
  commentId String
  type      LikeType @default(LIKE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  comment Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([userId, commentId])
  @@index([commentId])
}

model MatchLike {
  id        String   @id @default(cuid())
  userId    String
  matchId   String
  type      LikeType @default(LIKE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([userId, matchId])
  @@index([matchId])
}

// ─────────────────────────────
// FOOTBALL
// ─────────────────────────────

// externalId = ID від Football-Data.org API
// Mapper pattern: якщо API зміниться → міняємо тільки football.mapper.ts

model League {
  id         String  @id @default(cuid())
  externalId Int     @unique
  name       String
  slug       String  @unique
  country    String
  season     String
  logoUrl    String?

  clubs   Club[]
  matches Match[]
  table   LeagueTable[]
}

model Club {
  id         String  @id @default(cuid())
  externalId Int     @unique
  name       String
  slug       String  @unique
  shortName  String?
  logo       String?
  founded    Int?
  venue      String?
  leagueId   String

  league       League        @relation(fields: [leagueId], references: [id])
  homeMatches  Match[]       @relation("HomeClub")
  awayMatches  Match[]       @relation("AwayClub")
  tableEntries LeagueTable[]

  @@index([leagueId])
}

model Match {
  id         String      @id @default(cuid())
  externalId Int         @unique
  homeScore  Int?        // null до початку матчу
  awayScore  Int?
  date       DateTime    // зберігаємо UTC, конвертуємо на фронті
  status     MatchStatus @default(SCHEDULED)
  minute     Int?        // поточна хвилина для LIVE матчів
  matchday   Int?        // тур (football-data) — у репозиторії є
  leagueId   String
  homeClubId String
  awayClubId String

  league   League @relation(fields: [leagueId], references: [id])
  homeClub Club   @relation("HomeClub", fields: [homeClubId], references: [id])
  awayClub Club   @relation("AwayClub", fields: [awayClubId], references: [id])

  comments Comment[]
  likes    MatchLike[]

  @@index([leagueId])
  @@index([date])
  @@index([status])
  @@index([leagueId, date])
}

model LeagueTable {
  id           String @id @default(cuid())
  position     Int
  played       Int    @default(0)
  won          Int    @default(0)
  drawn        Int    @default(0)
  lost         Int    @default(0)
  points       Int    @default(0)
  goalsFor     Int    @default(0)
  goalsAgainst Int    @default(0)
  goalDiff     Int    @default(0)
  leagueId     String
  clubId       String

  league League @relation(fields: [leagueId], references: [id])
  club   Club   @relation(fields: [clubId], references: [id])

  @@unique([leagueId, clubId])
}
```

### Ключові рішення схеми і чому:

| Рішення | Чому |
|---|---|
| `PostTranslation` окрема таблиця | Нова мова = новий рядок, схема не міняється |
| `deletedAt` в Post і Comment | Soft delete — модерація без втрати даних |
| `parentId` в Comment | Replies без окремої таблиці |
| `postId?` + `matchId?` в Comment | Separate fields простіші ніж polymorphic для 2 сутностей |
| `PostLike` + `CommentLike` + `MatchLike` | Prisma не підтримує поліморфні FK — три таблиці дають реальні FK і каскади |
| `pinnedAt` в Comment | YouTube-стиль закріплення коментарів адміном |
| `externalId` в League/Club/Match | Mapper pattern — API змінився → міняємо тільки mapper |
| Індекси на `createdAt`, `date`, `status` | Запити по часу і статусу будуть частими |
| `email` lowercase в коді | Запобігає дублікатам `User@email.com` і `user@email.com` |

---

## 📌 Prisma та міграції — **рішення на зараз** (узгоджено)

- **`LikeType`:** залишаємо **`enum LikeType { LIKE DISLIKE }`**, **без** переходу на `String` + CHECK, доки немає реальної потреби. Перегляд схеми — **лише коли** з’явиться новий тип голосу чи інші вимоги.
- **`createPost`:** один `prisma.post.create` з nested `translations` / `tags` у Prisma вже атомарний; окремий `$transaction` — за потреби для складніших сценаріїв (зовнішній сервіс + БД).
- **Soft delete:** поки що достатньо фільтрів `deletedAt: null` у репозиторії; додаткові DB constraints — опційно пізніше.

---

## 🧭 Синтез external senior review (коротко)

| Тема | Висновок |
|------|----------|
| Helmet | Додати в API до прод — низький зусиль / високий ефект |
| CSRF | Високий пріоритет до публічного прод; імплементація під Nest + cross-origin (web/api); **не** покладатись на застарілий `csurf` без аудиту |
| Winston / Pino | Після структурованого Nest `Logger` — коли знадобляться файли / агрегація |
| `@nestjs/event-emitter` | Не зараз; коли 2+ підписники на подію або черги |
| Zustand | Вже є для auth — без змін «з нуля» |
| `GET /auth/me` + refresh | Залишається в roadmap polish |

### Короткий backlog якості (без зайвих міграцій)

1. **Helmet** у `main.ts`
2. **`@nestjs/throttler`** (хоча б `/auth/login`)
3. **Валідація `process.env`** при старті
4. **Ліміти в DTO** (`@MaxLength` тощо), де ще немає
5. **CSRF** (double-submit cookie + заголовок) під схему портів 3000 → 4000
6. **Файлові логи** — за потреби

---

## 🎯 Альфа-реліз: карта сторінок (web) + правила інтеграції


### Відмінності від generic prompt (важливо для Cursor / розробки)

| У prompt | У проєкті |
|----------|-----------|
| Generic prompt з `/uk/...` | У проєкті лише **`/ua/...`** і `messages/ua.json`. У Accept-Language браузер може надіслати стандартний код **`uk`** — у `proxy.ts` викликається **`normalizeAcceptLanguageForAppLocales`** (`accept-language.ts`), щоб next-intl бачив **`ua`**. Для `Intl` / дат лишається **`uk-UA`** у `content-lang.ts` (не сегмент URL). |
| `Competition` / `Team` / `Standing` | **`League`**, **`Club`**, **`LeagueTable`** (Prisma) |
| `teamId` у шляху | Краще **`[clubSlug]`** (є `Club.slug`); внутрішній `id` — для API за потреби |
| Окремі Nest-модулі `competitions`, `teams`, … | **Один** кореневий `FootballModule` + **внутрішні підмодулі**: `FootballIntegrationModule` (зовнішнє API), `FootballPersistenceModule`, `FootballQueryModule`, `FootballSyncModule` — див. **етап 5b** та дерево в **актуалізації**. |
| Модель `Player` у схемі | **Поки немає** в Prisma — сторінки **squad** / **players** або **після альфи**, або окремий етап із міграцією + синком |
| Крок «додати i18n» | **Вже зроблено** (next-intl, `app/[locale]`) — у плані альфи не повторювати |

### Глобальні вимоги альфи

- **i18n:** усі нові екрани — ключі перекладів, маршрути тільки під `[locale]`.
- **Зовнішній API:** виклики **лише** з Nest (`football-data.client`); фронт — **тільки** `NEXT_PUBLIC_API_URL` / `lib/api/http.ts`.
- **Ліміти football-data.org:** кеш на бекенді (in-memory, TTL **60–300 с**) для агрегованих read-ендпоінтів; не дублювати запити з кожного клієнта. Redis — коли буде кілька інстансів API.
- **Дані:** агрегаційний шар у бекенді (один відповідь = таблиця + найближчі матчі + список клубів тощо), щоб зменшити чатання з фронта.
- **Безпека:** httpOnly JWT + **CSRF на мутації** + Helmet + throttler до публічної альфи — список у **«Короткий backlog якості»** вище (Частина 2).
- **Не робити в альфі:** окремий продукт **live** на іншому платному API; **transfers** без стабільного джерела; прямі fetch до football-data з браузера.

### Цільове дерево `apps/web/src/app/[locale]/`

```
page.tsx                    ✅ головна (стрічка + сайдбар ліги)
news/
  [slug]/page.tsx           ✅
leagues/
  page.tsx                  ◻ список ліг (корисно при кількох змаганнях у БД)
  [leagueSlug]/
    page.tsx                ◻ hub ліги (огляд / швидкі посилання)
    standings/page.tsx      ◻ повноекранна таблиця
    matches/page.tsx        ◻ матчі ліги (тури / фільтри)
    clubs/page.tsx          ◻ клуби ліги
clubs/
  page.tsx                  ◻ опційно: каталог / пошук
  [clubSlug]/
    page.tsx                ◻ профіль клубу
    matches/page.tsx        ◻ матчі клубу
    squad/page.tsx          ◻ склад — ⚠️ потрібна модель гравця + дані (див. вище)
players/
  [playerId]/page.tsx       ◻ після появи Player у БД або винести з альфи-v1
matches/
  page.tsx                  ◻ загальний список матчів (дата / ліга)
  [id]/page.tsx             ✅ деталь матчу
calendar/
  page.tsx                  ◻ календар по матчах з БД
```

### Порядок імплементації (щоб не змішувати шари)

| Крок | Backend | Frontend |
|------|---------|----------|
| **A** | Розширити **football** (**етап 7.0**): агреговані ендпоінти + **кеш TTL** на read | — |
| **B** | — | `leagues/` + `[leagueSlug]/standings|matches|clubs` (реюз UI з сайдбару де можливо) |
| **C** | — | `clubs/[clubSlug]/` + `matches/` підмаршрут |
| **D** | — | `matches/page.tsx` (загальний список) |
| **E** | — | `calendar/page.tsx` |
| **F** | Опційно: міграція **Player** + синк з API (якщо доступно в тарифі) | `squad` + `players/[id]` |

### UX-орієнтир

Структура навігації в дусі SofaScore / Flashscore / ESPN: **ліга → таблиця / матчі → клуб → матч**; зрозумілі хлібні крихти та посилання з головної.

---

# ЧАСТИНА 3 — ПЛАН РЕАЛІЗАЦІЇ
> **Як читати:** нижче — етапи з чекбоксами `[x]` / `[ ]`. Щоб не роздувати файл, **детальний знімок** (що саме вже зроблено в репо) винесено в **«Актуалізація плану»** в кінці документа.
>
> **Порядок робіт (не змішувати):** **5b** (структура `football` — підмодулі Nest) → **6** (лайки) → **7** (альфа football UI + агрегація API) → **8** (коментарі / матчі / YouTube-глибина) → **9+** за номерами.

## ✅ Що вже зроблено

### Етап 0 — Monorepo ✅
- pnpm + turborepo
- apps/web (3000), apps/api (4000), apps/admin (3001)
- packages/types, packages/config

### Етап 1 — Backend основа ✅
- NestJS + Prisma 7 + PostgreSQL (Supabase)
- PrismaModule (@Global), перша міграція

### Етап 2 — Auth ✅
- Register / Login / Logout
- JWT httpOnly cookies (access 15хв + refresh 7д)
- JwtAuthGuard, RolesGuard, @Roles decorator
- ValidationPipe + class-validator

### Етап 3 — Posts + Comments ✅
- CRUD постів з пагінацією і Repository pattern
- Comments з прив'язкою до поста
- Публічні і захищені роути

### Етап 3.5 — Frontend основа ✅
- Головна сторінка зі списком постів (Server Component)
- Сторінка новини з CommentSection (Client Component)
- Auth форми — React Hook Form + Zod
- Navbar з auth станом
- Адмінка: логін + список постів + створення поста
- 404 сторінка

### Етап 4.3b — Football UI (web) ✅ (узгоджено з фактичним кодом)
- [x] Сайдбар ліги на головній (`FootballSidebar`, таблиця + тури)
- [x] Сторінка матчу `/[locale]/matches/[id]` (деталі + LIVE refetch)
- [x] Кнопка синку в адмінці (`POST /football/sync`) — за README/CLAUDE

### Етап 3.6 — TanStack Query (web + admin) ✅
- [x] `@tanstack/react-query` + DevTools у **apps/web** та **apps/admin**
- [x] `QueryClientProvider` через `providers/QueryProvider.tsx` у layout
- [x] `lib/query/queryClient.ts` — конфігурація `QueryClient`
- [x] Транспорт: **`lib/api/http.ts`** (`apiGet` / `apiPost` / `apiPut` / `apiDelete`), без окремого `client.ts`
- [x] Web: список постів і сторінка новини — `prefetchQuery` + `HydrationBoundary` + клієнтські `useQuery`; коментарі та auth — `useMutation` + `invalidateQueries` / `queryClient.clear` (logout)
- [x] Admin: список постів, логін, створення поста — React Query; форма POST `/posts` з `translations` (en + опційно ua)

### Етап 4.3 — Football API (backend) ✅
- [x] Модуль `football`: Query/Sync сервіси, HTTP-клієнт, throttle, utils; синк → БД; `GET …/dashboard`; `POST /sync` → 202 + фон

**Розподіл відповідальності:**
```
TanStack Query → клієнтський кеш, loading/error, мутації, prefetch + dehydrate для SSR
Zustand        → знімок user після логіну (web + admin), UI-стан
lib/api/http.ts → один шар fetch + credentials; виклики з queryFn / mutationFn / generateMetadata
```

**Приклад:**
```typescript
// ✅ queryOptions + prefetch на сервері, useQuery на клієнті
await queryClient.prefetchQuery(postsQueryOptions(1, 6, 'en'));

// ✅ useMutation
const { mutateAsync } = useMutation({
  mutationFn: (body) => apiPost('/posts', body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] }),
});
```

**Далі (опційно):** `useAuthQuery` / `/auth/me` для синхронізації сесії без лише Zustand.

---

### Етап 4 — Рефакторинг схеми + Football Module

#### 4.1 — Оновити Prisma схему v4.0 ✅ ЗАВЕРШЕНО
- [x] Замінити `schema.prisma` на v4.0
- [x] `PostTranslation` для i18n
- [x] `PostLike` / `CommentLike` / `MatchLike` — три окремі таблиці (YouTube-стиль)
- [x] `pinnedAt` в Comment
- [x] `soft delete` (deletedAt) в Post і Comment
- [x] `externalId` в League/Club/Match
- [x] Індекси на всі часті запити
- [x] `prisma migrate dev --name v4-schema` ✅

#### 4.2 — Рефакторинг Post API під нову схему ✅ (API + web + admin)
- [x] `CreatePostDto` — `translations: [{language, title, excerpt, content}]`
- [x] `post.repository.ts` — `translations`, фільтр по `lang`
- [x] `post.service.ts` — `lang` у публічних запитах
- [x] Comment DTO — `matchId?`, `parentId?`
- [x] `auth.service.ts` — `email.toLowerCase().trim()`
- [x] `GET /posts?lang=` та `GET /posts/:slug?lang=`
- [x] Адмінка — форма створення з блоками EN (обов'язково) та UA (опційно), TanStack Query

#### 4.3 — Football Module (NestJS) ✅ backend (+ шаруватість)
**Джерело правди — наша БД.** Синк: cron + `POST /football/sync` (**202 Accepted**, фоновий імпорт без Bull — див. README).

**Архітектура модуля (фактичне дерево `apps/api/src/football/`):**
- **`integration/`** — зовнішнє API: `football-data.client.ts`, `football.mapper.ts` (типи/мапінг відповіді партнера; при зміні API чіпати переважно тут + клієнт). `FootballIntegrationModule`.
- **`persistence/`** — `FootballRepository` + Prisma. `FootballPersistenceModule`.
- **`query/`** — `FootballQueryService`, усі **GET** з БД; `leagueBySlugOrThrow()`. `FootballQueryModule`.
- **`sync/`** — `FootballSyncService`, LIVE throttle, cron. `FootballSyncModule`.
- **Корінь `football/`** — `football.controller.ts`, `football.module.ts`, `football.constants.ts`, `football-matchday.util.ts`, `football-standings.util.ts`, `dto/`.
- `GET /football/leagues/:slug/dashboard` — таблиця + тури одним запитом (сайдбар).

- [x] `pnpm add @nestjs/schedule axios` (в apps/api)
- [x] Ключ [football-data.org](https://www.football-data.org/); пауза між запитами в `football.constants.ts`
- [x] Mapper, repository, cron, controller, DTO; підмодулі `integration` / `persistence` / `query` / `sync` (див. дерево вище)
- [x] `football.module.ts` + `AppModule` + `ScheduleModule.forRoot()`
- [x] `.env`: `FOOTBALL_*` (див. README); рекомендовано один пріоритетний competition через `Club.leagueId`

**Cron розклад:**
```
syncStandings()   → @Cron('0 */2 * * *')   кожні 2 год
syncMatches()     → @Cron('0 */2 * * *')   кожні 2 год
syncLiveMatches() → @Cron('*/5 * * * *')   кожні 5 хв (тільки LIVE)
initialSync()     → POST /api/v1/football/sync  вручну один раз
```

**Mapper pattern — захист від змін API:**
```typescript
// football.mapper.ts
mapStatus(apiStatus: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    'SCHEDULED': MatchStatus.SCHEDULED,
    'IN_PLAY':   MatchStatus.LIVE,
    'FINISHED':  MatchStatus.FINISHED,
    'POSTPONED': MatchStatus.POSTPONED,
    'CANCELLED': MatchStatus.CANCELLED,
  };
  return map[apiStatus] ?? MatchStatus.SCHEDULED;
}
```

**Rate limit (free tier = 10 req/хв):**
```typescript
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
await delay(6000); // 6 сек між запитами
```

**Upsert стратегія (без дублікатів):**
```typescript
await this.prisma.club.upsert({
  where: { externalId: apiTeam.id },
  create: { externalId: apiTeam.id, name: apiTeam.name, ... },
  update: { name: apiTeam.name, logo: apiTeam.crest },
});
```

**Потенційні пастки:**
- Null scores до початку матчу — завжди перевіряй
- API повертає UTC — зберігай як є, конвертуй на фронті
- externalId — це Int, не String
- Rate limit — завжди додавай delay між запитами

---

### Етап 5 — i18n (Мультимовність)

- [x] `pnpm add next-intl`
- [x] App Router структура: `app/[locale]/...` (корінь без `page.tsx`, лише `/[locale]/...`)
- [x] `messages/en.json`, `messages/ua.json`
- [x] **Next.js 16:** `src/proxy.ts` замість `middleware.ts` + `createMiddleware` (next-intl)
- [x] Локалі в маршруті та API: лише **`en` | `ua`**. Cookie + **Accept-Language**; у `proxy.ts` — **`normalizeAcceptLanguageForAppLocales`** (ISO-код **`uk`** у заголовку замінюється на **`ua`** для next-intl). Окремо для дат: BCP47 **`uk-UA`** у `content-lang.ts`.
- [x] Типізація ключів повідомлень: `src/global.ts` (`AppConfig.Messages`, `Locale`) + `createMessagesDeclaration` у `next.config`
- [x] Перемикач мови в Navbar
- [x] API: `GET /posts?lang=` з сегмента URL (`en` | `ua`)
- [x] Локалізація дат (`localeToBcp47`), статусів матчів і UI сайдбару через переклади

---

### Етап 5b — Модуль `football`: підмодулі Nest + шар зовнішнього API ✅

**Мета:** один HTTP-домен `FootballModule`, шари `integration` / `persistence` / `query` / `sync` — **детальне дерево файлів і модулів у підрозділі 4.3** (блок «Архітектура модуля»), тут без повторення.

- [x] `FootballIntegrationModule` — `integration/` (`football-data.client`, `football.mapper`).
- [x] `FootballPersistenceModule` — `persistence/` (`FootballRepository`).
- [x] `FootballQueryModule` — `query/` (`FootballQueryService`).
- [x] `FootballSyncModule` — `sync/` (`FootballSyncService`, `FootballLiveThrottleService`, `FootballCronService`).
- [x] `football.module.ts` імпортує query + sync; `football.controller.ts` у корені разом з `dto/`, константами та утилітами.
- [ ] Нові агреговані ендпоінти альфи + кеш TTL — **етап 7.0** (без додаткових кореневих модулів поза `football`).

---

### Етап 6 — Likes система

#### 6.1 — Backend
- [ ] `src/likes/like.module.ts`
- [ ] `src/likes/like.service.ts` — toggle логіка (є лайк → видалити, немає → створити)
- [ ] `src/likes/like.controller.ts`
  - `POST /likes` — toggle like/dislike
  - `GET /likes/stats/:targetType/:targetId` — кількість лайків і дізлайків

#### 6.2 — Frontend
- [ ] `components/features/LikeButton.tsx` (Client Component)
  - Показує кількість лайків (👍 N)
  - Дізлайки не показуються публічно
  - Оптимістичне оновлення (UI змінюється одразу, потім запит)
- [ ] Підключити до сторінки новини
- [ ] Підключити до CommentSection
- [ ] Підключити до сторінки матчу

---

### Етап 7 — Футбольні сторінки (web) + **альфа-scope**

Детальна карта маршрутів — у розділі **«Альфа-реліз: карта сторінок»** вище (кроки A–F). **Окремо від етапу 6** (спочатку лайки, потім цей блок).

#### 7.0 — Backend під альфу (паралельно з UI)
- [ ] Агреговані ендпоінти в `football` (hub ліги, список матчів, календар, сторінка клубу) — поверх існуючого repository
- [ ] In-memory кеш read-only з TTL 60–300 с (ключ: leagueSlug / clubSlug / date range); задокументувати інвалідацію після sync
- [ ] Розширення API альфи в межах існуючих підмодулів `football` (**етап 5b** вже застосовано)

#### 7.1 — Ліги
- [ ] `/[locale]/leagues/page.tsx` — список ліг (актуально при >1 змаганні)
- [ ] `/[locale]/leagues/[leagueSlug]/page.tsx` — hub ліги
- [ ] `.../standings/page.tsx` — повна таблиця
- [ ] `.../matches/page.tsx` — матчі ліги (тури)
- [ ] `.../clubs/page.tsx` — клуби ліги
- [x] Таблиця + тури на **головній** (сайдбар) — вже є; після hub — лінки

#### 7.2 — Клуби (teams у generic naming)
- [ ] `/[locale]/clubs/page.tsx` — опційно
- [ ] `/[locale]/clubs/[clubSlug]/page.tsx` — картка клубу
- [ ] `/[locale]/clubs/[clubSlug]/matches/page.tsx` — матчі клубу

#### 7.3 — Матчі та календар
- [ ] `/[locale]/matches/page.tsx` — загальний список (фільтр по даті/лізі)
- [x] `/[locale]/matches/[id]/page.tsx` — деталь (коментарі на матчі — **етап 8**; лайки — **етап 6**)
- [ ] `/[locale]/calendar/page.tsx` — календар

#### 7.4 — Гравці / склад (поза мінімальною альфою, якщо немає Player у БД)
- [ ] Рішення: міграція `Player` + синк **або** відкласти після v1 альфи
- [ ] `/[locale]/clubs/[clubSlug]/squad/page.tsx`
- [ ] `/[locale]/players/[playerId]/page.tsx`

#### 7.5 — Live / transfers (не альфа)
- [ ] Окремий етап: live-стрім даних (інший API / SSE) — поза поточним football-data free tier
- [ ] Transfers — лише за наявності джерела даних

---

### Етап 8 — Comments розширення (replies, матчі, YouTube-глибина)

#### 8.1 — Backend ✅ (база) · далі за потреби
- [x] `CreateCommentDto` — `parentId?: string`
- [x] `comment.repository.ts` / `post.repository` — replies у дереві коментарів до поста
- [x] Валідація в `comment.service`: відповідь не на відповідь (один рівень вкладеності)
- [ ] Система коментарів як в youtube
- [ ] Кнопка "Reply" під кожним коментарем, щоб можна було відповідати далі під коментарем один одному як в youtube

#### 8.2 — Frontend
- [x] `CommentSection.tsx` — replies для **поста**
- [ ] Те саме UX для коментарів на **сторінці матчу** (коли підключите `matchId` у UI)

---

### Етап 9 — Теги і категорії

#### 9.1 — Backend
- [ ] `src/tags/tag.module.ts`
- [ ] CRUD тегів (тільки ADMIN створює)
- [ ] `GET /tags` — список всіх тегів
- [ ] `GET /posts?tag=premier-league` — пости по тегу
- [ ] Оновити `CreatePostDto` — `tagIds?: string[]`

#### 9.2 — Frontend
- [ ] Теги на картці поста і сторінці новини
- [ ] `/posts/page.tsx` — всі пости з фільтром по тегах
- [ ] Sidebar або горизонтальний список тегів

---

### Етап 10 — Профіль користувача

#### 10.1 — Backend
- [ ] `src/users/user.controller.ts`
  - `GET /users/:id` — публічний профіль
  - `GET /users/:id/comments` — коментарі юзера (для авторизованих)
  - `PUT /users/me` — редагування свого профілю (name, bio, avatar)
- [ ] `src/users/user.service.ts`
- [ ] `src/users/user.repository.ts`

#### 10.2 — Frontend
- [ ] `/profile/[id]/page.tsx`
  - Аватар, ім'я, bio
  - Список коментарів юзера (для авторизованих)
- [ ] `/profile/me/page.tsx` — свій профіль з формою редагування

---

### Етап 11 — Адмінка (розширення)

- [ ] Редагування постів
- [ ] Управління тегами (CRUD)
- [x] Ручний тригер sync (`POST /football/sync`) — кнопка на дашборді
- [ ] Статистика лайків і дізлайків (тільки адмін бачить дізлайки)
- [ ] Модерація коментарів (soft delete через `deletedAt`)
- [ ] Список AI-парсингу новин (чернетки з `sourceUrl`)

---

### Етап 12 — Адаптивність (Mobile)

- [ ] Мобільне меню (burger)
- [ ] Адаптивна сітка постів
- [ ] Адаптивна таблиця ліги (горизонтальний скрол або спрощена)
- [ ] Тестування: 320px, 375px, 768px, 1024px, 1440px

---

### Етап 13 — SEO

- [ ] `generateMetadata` для всіх сторінок (враховувати мову)
- [ ] OpenGraph теги (title, description, image)
- [ ] `sitemap.ts` — динамічний sitemap
- [ ] JSON-LD structured data для матчів і статей

---

### Етап 14 — Деплой + CI/CD

- [ ] GitHub Actions: lint + build при PR
- [ ] Vercel для web + admin
- [ ] Railway для api
- [ ] Environment variables в продакшні
- [ ] CORS оновити на продакшн домени

---

### Етап 15 — Live матчі (Real-time)

- [ ] Server-Sent Events (SSE) або WebSocket на беку
- [ ] `@nestjs/websockets` або SSE endpoint в football.controller
- [ ] Фронт: оновлення рахунку і хвилини без перезавантаження
- [ ] Індикатор 🔴 LIVE на картці матчу

---

### Етап 16 — Модерація і фільтрація

- [ ] Фільтр нецензурної лексики (`bad-words` або власний список)
- [ ] Middleware на `POST /comments`
- [ ] Можливість скаржитись на коментар (report)
- [ ] В адмінці: список скарг + швидке видалення

---


## 🔮 Після MVP (низький пріоритет)

### AI-парсинг новин
- [ ] Сервіс парсингу відкритих джерел
- [ ] Зберігає як чернетки з `sourceUrl`
- [ ] Адмін редагує і публікує вручну

### Слеш-ігри і інтерактиви
- [ ] Прогнози матчів (вгадай рахунок)
- [ ] Голосування за гравця матчу
- [ ] Лідерборд по прогнозах

### Redis кешування
- [ ] Кеш таблиці ліги (інвалідація при CRON)
- [ ] Кеш популярних постів
- [ ] Rate limiting через Redis

### Тести
- [ ] Jest unit тести для сервісів
- [ ] Integration тести для API endpoints
- [ ] E2E тести (Playwright)

### Docker
- [ ] docker-compose для локальної розробки
- [ ] Контейнери для api, web, admin, postgres

---

## 📍 Актуалізація плану (знімок стану репозиторію)

Оновлювати при значних змінах. Детальні етапи з чекбоксами — у розділі **«Етапи»** вище.

### Завершено (узагальнено)

- **0 — Monorepo:** pnpm + Turborepo; web (3000), api (4000), admin (3001); `packages/types`, `packages/config`.
- **1 — Backend основа:** NestJS + Prisma 7 + PostgreSQL; глобальний PrismaModule.
- **2 — Auth:** register/login/logout; JWT у httpOnly cookies; guards; ValidationPipe.
- **3 — Posts + Comments:** CRUD постів, коментарі, репозиторії.
- **3.5 — Web основа:** головна, новина, auth, navbar, адмінка базово, 404.
- **3.6 — TanStack Query:** web + admin; `lib/api/http.ts`; prefetch/hydrate для постів.
- **4.1–4.2 — Схема v4 + Post API:** `PostTranslation`, likes-таблиці, comments `matchId`/`parentId`, адмінка з перекладами.
- **4.3 + 5b — Football API:** sync, dashboard, cron, throttle; підмодулі `integration` / `persistence` / `query` / `sync`; корінь — controller, constants, utils, `dto/` (деталі — **Етап 4.3** у тексті плану).
- **4.3b — Football UI (мінімум):** сайдбар на головній, `/[locale]/matches/[id]`, sync-кнопка в адмінці.
- **5 — i18n:** next-intl, `app/[locale]/...`, локалі **`en` | `ua`**; у `proxy` нормалізація Accept-Language (**`uk*` → `ua`**) для next-intl; для `Intl` — `uk-UA` у `content-lang.ts`.
- **5b — Football структура:** підмодулі `FootballIntegrationModule`, `FootballPersistenceModule`, `FootballQueryModule`, `FootballSyncModule` (див. етап 5b у плані).

### У роботі / наступні за планом v4.4

1. **6** — лайки.  
2. **7** — альфа football UI + агреговані ендпоінти + кеш.  
3. **8** — коментарі на матчі (+ глибина YouTube за потреби).  
4. Далі **9+** за нумерацією в плані.

### Патерн даних (нагадування)

```
TanStack Query → клієнтський кеш, мутації, prefetch/dehydrate
Zustand        → user після логіну (web/admin)
lib/api/http.ts → єдиний fetch + credentials
```

**Опційно:** `GET /auth/me` + `useAuthQuery` для сесії після F5.

---

## 🤖 Контекст для AI (вставляти на початку нової сесії)

**Проект:** Футбольний портал (новини з i18n, матчі, клуби, ліги, профілі, теги, лайки, replies).
**Стек:**
- Web: Next.js 16 + React 19 + Tailwind 4 + React Hook Form + Zod + Zustand + TanStack Query + **next-intl** (`app/[locale]/...`, порт 3000)
- Admin: Next.js 16 + TanStack Query (порт 3001)
- API: NestJS 11 + Prisma 7 + PostgreSQL (порт 4000)
- Monorepo: pnpm + Turborepo

**БД:** PostgreSQL (Supabase). Prisma schema v4: `PostTranslation`, soft delete, `PostLike`/`CommentLike`/`MatchLike`, football-моделі з `externalId` та `Match.matchday`.
**Ліги:** Football-Data.org v4, синк + dashboard endpoint, LIVE throttle.
**Auth:** JWT у **httpOnly** cookies (`sameSite: lax`), ролі ADMIN/USER; логін з адмінки.
**Безпека:** class-validator + CORS + cookies — є; **Helmet, throttler, CSRF — заплановані/частково** (див. Частину 1 плану).
**Архітектура:** Controller → Service → Repository → Prisma; football: підмодулі + mapper/client у `integration/`; soft delete Post/Comment.

**Що вже зроблено:** auth, posts + i18n (`lang` = `en`|`ua`), comments + replies (новини), football API (підмодулі) + сайдбар + `/matches/[id]`, admin (пости, sync), next-intl + нормалізація Accept-Language `uk*`→`ua` у proxy.

**Альфа (див. план):** football UI — `leagues/*`, `clubs/*`, `matches` (список), `calendar`; бек — агреговані ендпоінти + кеш TTL; гравці/squad — коли з’явиться модель `Player` або окрема версія.

**Наступні кроки (порядок):** **6** (лайки) → **7** (альфа UI + API) → **8** (коментарі на матчі). Потім теги (9), профіль (10), адмінка (11+). Перед публічним прод: Helmet, throttler, CSRF; опційно `/auth/me`.

---