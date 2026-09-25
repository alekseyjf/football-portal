# 🧱 Football Portal — Intermediate Plan: Schema v5

> **Статус:** ◐ у процесі — Фази 0–1 ✅, Фаза 2 (2a–2e) у процесі
> **Виконується:** ДО продовження основного плана (`football-plan-new.md`, етапи 7+)
> **Після завершення:** перенести ключові рішення в Частину 2 основного плана, цей файл — в архів.
> **Створено:** 2026-09-24

---

## 0. Навіщо цей план

Зараз БД ще не на проді. Це найдешевший момент змінити **структуру** (зв'язки, ключі, кардинальність). Після релізу кожна така зміна — expand/backfill/contract на живих даних.

Цілі:

1. Розбити БД на **домени з чіткою відповідальністю** (identity, moderation, content, engagement, football, sync).
2. Зробити **нашу БД єдиним джерелом правди**, а зовнішні API — змінними постачальниками даних (provider-agnostic).
3. Підтримати **кілька турнірів і сезонів** (PL + CL + кубки) без конфліктів.
4. Виправити auth: зберігати refresh-сесії, ротація, відкликання.
5. Перед релізом — **одна baseline-міграція** замість історії dev-міграцій.

---

## 1. Принцип: що робимо зараз, а що — потім

> Більше таблиць ≠ краще. Таблиця виправдана, коли дані мають **власний життєвий цикл**, **іншу кардинальність** (1:N, M:N) або **іншу швидкість змін**. Зайве дроблення 1:1 = зайві join-и.

| Тип зміни | Приклад | Коли |
|---|---|---|
| **Структурна** (зв'язок, ключ, кардинальність, перейменування) | `Club.leagueId` → M:N через сезон; `externalId` → окрема таблиця | **Зараз** — потім дорого |
| **Адитивна** (нова таблиця, nullable колонка, нове значення enum) | `Player`, `ClubTranslation`, `MatchEvent` | **Коли знадобиться** — безболісно |

Тому в v5 робимо всі структурні зміни, а адитивні лише **проєктуємо** (розділ 9), щоб знати, що вони ляжуть без переробок.

---

## 2. Ключові рішення

| # | Рішення | Чому |
|---|---|---|
| D1 | `League` → **`Competition`** (`type: LEAGUE \| CUP`) | ЛЧ, кубки, ЧС — не «ліги». Одна таблиця для всіх турнірів |
| D2 | Нова сутність **`Season`**; `Match` і `Standing` прив'язані до сезону | Історія сезонів, таблиці минулих років, перехід сезону без втрат |
| D3 | `Club` **без** `leagueId`; участь — через **`SeasonClub`** (M:N) | Клуб грає в PL і CL одночасно; вилітає/підвищується між сезонами |
| D4 | `LeagueTable` → **`Standing`** з `stage`, `groupName`, `type` (TOTAL/HOME/AWAY) | Групи ЛЧ, кілька таблиць в одному сезоні |
| D5 | `externalId` винесено в **`*ExternalRef`** таблиці `(provider, externalId)` | Зміна/додавання провайдера без міграції доменних таблиць; одна сутність може мати id у кількох провайдерах |
| D6 | **`SyncRun`** — журнал і лок синку | Видно, що/коли/скільки синкнулось; неможливо запустити два синки одного турніру паралельно |
| D7 | Список турнірів для синку — **з БД** (`Competition.isActive`), env лише для seed | Додати турнір = рядок у БД/кнопка в адмінці, без редеплою |
| D8 | **`Language`** — таблиця, не enum/рядок | Нова мова = `INSERT` + файл перекладів на web, без міграції |
| D9 | Fallback контенту: запитана мова → мова `isDefault` (**en**) | Нова мова без перекладу показує англійську; `slug` один на пост |
| D10 | `Post.published` → **`status` + `publishedAt`** | Чернетки (AI-парсинг), відкладена публікація, стрічка сортується за датою публікації |
| D11 | **`CommentThread`** — одна «гілка обговорення» на пост/матч | Коментар має один FK (`threadId`); новий об'єкт для коментування = колонка в `CommentThread`, а не в `Comment`. Тут же `isLocked`, `commentCount` |
| D12 | `Comment.rootId` + `depth` + `replyCount` зберігаються | Гілка відповідей одним запитом; без рекурсивного `depthFromRoot` |
| D13 | `User` = лише ідентичність; **`UserProfile`** 1:1 для публічних даних | Auth-запити не тягнуть профіль; профіль розширюється (улюблений клуб тощо) без чіпання auth |
| D14 | Анти-абуз з `User` → **`UserSanction`** (історія) + **`RateLimitEvent`** | Видно хто/коли/за що; strikes = `count`; ручні бани з адмінки |
| D15 | **`AuthSession`** — refresh-токени в БД (хеш), ротація, reuse-detection | Logout реально відкликає; «вийти на всіх пристроях»; вкрадений токен не живе 7 днів |
| D16 | Новини ↔ футбол: **`PostCompetition`**, **`PostClub`** (окремо від тегів) | Сторінка клубу показує його новини; теги лишаються редакційними темами |
| D17 | **`TagTranslation`** | Теги i18n з тим самим fallback, що й пости |
| D18 | `Match.stage` — **String** (нормалізований mapper-ом), не enum | Провайдер може повернути нову стадію — синк не має падати |
| D19 | Видалення користувача = **анонімізація** (`status = DELETED`, `deletedAt`), не фізичний `DELETE` | `Post.author`/`Comment.author` — `onDelete: Restrict`; анонімізація не чіпає FK і зберігає цілісність постів/тредів |
| D20 | Коментар: **soft delete** (є) + окремий **hard delete / purge** (ADMIN, для legal/GDPR-запитів) | Soft delete ховає контент, лишає рядок; purge реально видаляє рядок з БД. Дозволений лише для листкового коментаря (`replyCount = 0`) або через `purge-thread` (уся гілка), щоб не впасти на `Comment.parent`/`Comment.root` (`Restrict`) |

---

## 3. Відповіді на питання, які виникли при аналізі

### Ліга чемпіонів і ліги — розділяти?
Ні, **окремих таблиць не треба**. Усі турніри лежать в одній `Competition`. Розділяти треба **клуб і турнір**: клуб не «належить» лізі, він **бере участь у сезоні** турніру (`SeasonClub`). Тоді Arsenal одночасно в `PL 2025/26` і `CL 2025/26`, і синк одного турніру не ламає інший.

### Refresh-токен не знає про access-токен?
Так і має бути: це два незалежні JWT з різними секретами. Проблеми інші:
1. **Немає `POST /auth/refresh`**: `AuthService.refreshTokens` існує, але не підключений до роуту. Через 15 хв сесія просто закінчується.
2. **Refresh не зберігається на сервері**: logout лише чистить cookie. Вкрадений токен працює 7 днів, відкликати його неможливо.
3. **Однаковий payload** і cookie `refresh_token` летить на **всі** запити (немає `path`).

Виправлення — Фаза 2 (`AuthSession`, ротація, cookie з `path=/api/v1/auth`).

### Окрема таблиця під кожну лігу / кубок?
Ні. Проблема «купи» не в одній таблиці, а в `Club.leagueId` і відсутності сезонів (див. **3.1**). Розділення робимо **ключем** (`seasonId`, `stage`, `groupName`), а не таблицею (див. **6.3**).

### 3.1 Діагноз поточної БД (read-only SELECT, 2026-09-25)

| Факт | Дані | Причина |
|---|---|---|
| `LeagueTable` (standings) **вже розділені правильно** | PL 20 рядків, SA 20, BL1 18…; у кожній таблиці лише клуби своєї ліги | `replaceLeagueStandings(leagueId)` |
| **Список клубів ліги зіпсований** | у BL1 лише 14 «своїх» клубів із 18; 18 клубів різних ліг «переїхали» в CL (`Club.leagueId = CL`) | `upsertClub` перезаписує `leagueId` останнім синком → **D3** |
| **PL змішує 2 сезони** | 760 матчів з 2025-08 по 2027-05; 23 клуби (20 + підвищені у 2026/27); `season = '2026/2027'` | немає сутності `Season`, рядок перезаписується → **D2** |
| WC/EC — збірні як «клуби»; WC має label `2026/2026` | 35 + 24 записи в `Club` | немає `ClubKind`; баг `seasonLabelFromFd` |
| Контент | 3 пости, 2 користувачі, 8 коментарів, 14 лайків | — |

**Висновок:** окрема таблиця на лігу це б не виправила — CL все одно ділить клубів з PL/BL1/SA.

**Очищення БД:** так, але **у Фазі 1 через `prisma migrate reset`**, не раніше. Якщо очистити зараз і синкнути поточним кодом — плутанина відтвориться. Пости й адмін зберігаються через експорт (Фаза 0).

---

## 4. Карта доменів

```
IDENTITY      User · UserProfile · AuthSession
MODERATION    UserSanction · RateLimitEvent
CONTENT       Language · Post · PostTranslation · Tag · TagTranslation · PostTag
              PostCompetition · PostClub
ENGAGEMENT    CommentThread · Comment · PostLike · CommentLike · MatchLike · UserReactionActivity
FOOTBALL      Area · Competition · Season · SeasonClub · Club · Match · Standing
SYNC          CompetitionExternalRef · SeasonExternalRef · ClubExternalRef · MatchExternalRef · SyncRun
```

Правило залежностей: **FOOTBALL не знає про провайдерів** (жодного `externalId` у доменних таблицях); про провайдерів знає лише SYNC + `integration/`.

---

## 5. Цільова схема v5 (`apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ═════════════════════════════════════════
// ENUMS
// ═════════════════════════════════════════

enum Role {
  USER
  ADMIN
}

/// Поточний стан (швидка перевірка в JwtStrategy). Історія — у UserSanction.
enum UserStatus {
  ACTIVE
  LOCKED
  /// Акаунт анонімізовано (self-service або admin). Рядок User лишається — див. D19.
  DELETED
}

enum SanctionType {
  LIKES_SUSPENDED
  COMMENTS_SUSPENDED
  ACCOUNT_LOCKED
  /// Admin ініціював видалення чужого акаунта (self-delete сюди не логується — deletedAt і так аудит)
  ACCOUNT_DELETED
}

enum SanctionReason {
  LIKE_BURST
  COMMENT_BURST
  MANUAL
}

enum RateLimitAction {
  LIKE
  COMMENT
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  ARCHIVED
}

/// Як на YouTube: публічно показуємо лише LIKE
enum LikeType {
  LIKE
  DISLIKE
}

enum ReactionTarget {
  POST
  COMMENT
  MATCH
}

/// Новий провайдер = ALTER TYPE ADD VALUE (адитивно)
enum DataProvider {
  FOOTBALL_DATA
}

enum CompetitionType {
  LEAGUE
  CUP
}

enum ClubKind {
  CLUB
  NATIONAL
}

enum MatchStatus {
  SCHEDULED
  LIVE
  PAUSED
  FINISHED
  POSTPONED
  SUSPENDED
  CANCELLED
  AWARDED
}

enum MatchWinner {
  HOME
  AWAY
  DRAW
}

enum StandingType {
  TOTAL
  HOME
  AWAY
}

enum SyncScope {
  COMPETITION_FULL
  MATCHES_LIVE
  STANDINGS
}

enum SyncStatus {
  RUNNING
  SUCCEEDED
  PARTIAL
  FAILED
}

enum SyncTrigger {
  ADMIN
  CRON
  LIVE_TOUCH
}

// ═════════════════════════════════════════
// IDENTITY
// ═════════════════════════════════════════

/// Лише ідентичність і доступ. Публічні дані — UserProfile.
model User {
  id           String     @id @default(cuid())
  /// Завжди toLowerCase().trim()
  email        String     @unique
  passwordHash String
  role         Role       @default(USER)
  status       UserStatus @default(ACTIVE)
  lockedAt     DateTime?
  /// Встановлюється при видаленні акаунта (D19); email/passwordHash/профіль вже анонімізовані
  deletedAt    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  profile            UserProfile?
  sessions           AuthSession[]
  sanctions          UserSanction[]         @relation("SanctionedUser")
  issuedSanctions    UserSanction[]         @relation("SanctionIssuer")
  rateLimitEvents    RateLimitEvent[]
  posts              Post[]
  comments           Comment[]
  postLikes          PostLike[]
  commentLikes       CommentLike[]
  matchLikes         MatchLike[]
  reactionActivities UserReactionActivity[]
}

model UserProfile {
  userId      String   @id
  displayName String
  avatarUrl   String?
  bio         String?
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// Refresh-сесія. У cookie — сирий токен, у БД — лише SHA-256 хеш.
model AuthSession {
  id         String    @id @default(cuid())
  userId     String
  /// Усі ротації від одного логіну мають один familyId (для reuse-detection)
  familyId   String
  tokenHash  String    @unique
  userAgent  String?
  ipAddress  String?
  expiresAt  DateTime
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@index([expiresAt])
}

// ═════════════════════════════════════════
// MODERATION
// ═════════════════════════════════════════

model UserSanction {
  id         String         @id @default(cuid())
  userId     String
  type       SanctionType
  reason     SanctionReason
  note       String?
  startsAt   DateTime       @default(now())
  /// null = безстроково
  endsAt     DateTime?
  revokedAt  DateTime?
  /// null = автоматично (анти-абуз)
  issuedById String?
  createdAt  DateTime       @default(now())

  user     User  @relation("SanctionedUser", fields: [userId], references: [id], onDelete: Cascade)
  issuedBy User? @relation("SanctionIssuer", fields: [issuedById], references: [id], onDelete: SetNull)

  @@index([userId, type, endsAt])
}

/// Ефемерні події для burst/cooldown. Очищається cron-ом (> 24 год).
model RateLimitEvent {
  id        BigInt          @id @default(autoincrement())
  userId    String
  action    RateLimitAction
  createdAt DateTime        @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, action, createdAt])
  @@index([createdAt])
}

// ═════════════════════════════════════════
// CONTENT
// ═════════════════════════════════════════

/// Нова мова = INSERT + messages/<code>.json на web. Рівно одна isDefault (partial unique у SQL).
model Language {
  code      String  @id
  name      String
  isDefault Boolean @default(false)
  isActive  Boolean @default(true)
  sortOrder Int     @default(0)

  postTranslations PostTranslation[]
  tagTranslations  TagTranslation[]
}

model Post {
  id            String     @id @default(cuid())
  /// Один slug на всі мови (генерується з EN-заголовка)
  slug          String     @unique
  status        PostStatus @default(DRAFT)
  publishedAt   DateTime?
  coverImageUrl String?
  videoUrl      String?
  sourceUrl     String?
  authorId      String
  /// Денормалізовано з PostLike — оновлюється в тій самій транзакції
  likeCount     Int        @default(0)
  dislikeCount  Int        @default(0)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?

  author        User              @relation(fields: [authorId], references: [id], onDelete: Restrict)
  translations  PostTranslation[]
  tags          PostTag[]
  competitions  PostCompetition[]
  clubs         PostClub[]
  commentThread CommentThread?
  likes         PostLike[]

  @@index([status, deletedAt, publishedAt(sort: Desc)])
  @@index([authorId])
}

model PostTranslation {
  postId       String
  languageCode String
  title        String
  excerpt      String
  content      String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  language Language @relation(fields: [languageCode], references: [code])

  @@id([postId, languageCode])
}

/// Редакційна тема (трансфери, аналітика). Назва — у TagTranslation.
model Tag {
  id        String   @id @default(cuid())
  slug      String   @unique
  createdAt DateTime @default(now())

  translations TagTranslation[]
  posts        PostTag[]
}

model TagTranslation {
  tagId        String
  languageCode String
  name         String

  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  language Language @relation(fields: [languageCode], references: [code])

  @@id([tagId, languageCode])
}

model PostTag {
  postId String
  tagId  String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@index([tagId])
}

/// Новина стосується турніру (стрічка на сторінці ліги)
model PostCompetition {
  postId        String
  competitionId String

  post        Post        @relation(fields: [postId], references: [id], onDelete: Cascade)
  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)

  @@id([postId, competitionId])
  @@index([competitionId])
}

/// Новина стосується клубу (стрічка на сторінці клубу)
model PostClub {
  postId String
  clubId String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  club Club @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@id([postId, clubId])
  @@index([clubId])
}

// ═════════════════════════════════════════
// ENGAGEMENT
// ═════════════════════════════════════════

/// Одна гілка обговорення на об'єкт. Рівно один із postId/matchId (CHECK у SQL).
/// Новий об'єкт для коментування (клуб, гравець) = нова nullable колонка ТУТ + оновити CHECK.
model CommentThread {
  id           String   @id @default(cuid())
  postId       String?  @unique
  matchId      String?  @unique
  isLocked     Boolean  @default(false)
  commentCount Int      @default(0)
  createdAt    DateTime @default(now())

  post     Post?     @relation(fields: [postId], references: [id], onDelete: Cascade)
  match    Match?    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  comments Comment[]
}

model Comment {
  id           String    @id @default(cuid())
  threadId     String
  authorId     String
  /// Безпосередній батько (на кого відповіли)
  parentId     String?
  /// Кореневий коментар гілки; null — якщо сам корінь
  rootId       String?
  depth        Int       @default(0)
  content      String
  replyCount   Int       @default(0)
  likeCount    Int       @default(0)
  dislikeCount Int       @default(0)
  pinnedAt     DateTime?
  editedAt     DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  thread      CommentThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author      User          @relation(fields: [authorId], references: [id], onDelete: Restrict)
  parent      Comment?      @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Restrict)
  replies     Comment[]     @relation("CommentReplies")
  root        Comment?      @relation("CommentRoot", fields: [rootId], references: [id], onDelete: Restrict)
  descendants Comment[]     @relation("CommentRoot")
  likes       CommentLike[]

  @@index([threadId, parentId, createdAt])
  @@index([threadId, pinnedAt])
  @@index([rootId, createdAt])
  @@index([authorId, createdAt])
}

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

/// Історія реакцій (профіль / аналітика). Поліморфна без FK — свідомо (лог).
model UserReactionActivity {
  id         BigInt         @id @default(autoincrement())
  userId     String
  targetType ReactionTarget
  targetId   String
  /// null = голос знято
  reaction   LikeType?
  createdAt  DateTime       @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}

// ═════════════════════════════════════════
// FOOTBALL (домен — без знань про провайдерів)
// ═════════════════════════════════════════

model Area {
  id      String  @id @default(cuid())
  /// ENG, ITA, EUR, WORLD — стабільний код
  code    String  @unique
  name    String
  flagUrl String?

  competitions Competition[]
  clubs        Club[]
}

model Competition {
  id        String          @id @default(cuid())
  /// PL, CL — задається при створенні, синк НЕ перезаписує
  slug      String          @unique
  name      String
  type      CompetitionType @default(LEAGUE)
  areaId    String?
  emblemUrl String?
  /// Чи синкати й показувати (замість FOOTBALL_COMPETITION_IDS)
  isActive  Boolean         @default(true)
  sortOrder Int             @default(0)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  area         Area?                    @relation(fields: [areaId], references: [id], onDelete: SetNull)
  seasons      Season[]
  matches      Match[]
  externalRefs CompetitionExternalRef[]
  posts        PostCompetition[]
}

/// Один рядок на сезон турніру. Рівно один isCurrent на турнір (partial unique у SQL).
model Season {
  id              String   @id @default(cuid())
  competitionId   String
  /// "2025/26" або "2026" для турнірів в межах року
  label           String
  startDate       DateTime @db.Date
  endDate         DateTime @db.Date
  isCurrent       Boolean  @default(false)
  currentMatchday Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  competition  Competition         @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  participants SeasonClub[]
  matches      Match[]
  standings    Standing[]
  externalRefs SeasonExternalRef[]

  @@unique([competitionId, label])
}

/// Участь клубу в сезоні турніру (M:N)
model SeasonClub {
  seasonId String
  clubId   String

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  club   Club   @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@id([seasonId, clubId])
  @@index([clubId])
}

model Club {
  id          String   @id @default(cuid())
  /// Стабільний: створюється один раз, синк НЕ перезаписує (SEO / URL)
  slug        String   @unique
  name        String
  shortName   String?
  tla         String?
  kind        ClubKind @default(CLUB)
  areaId      String?
  crestUrl    String?
  founded     Int?
  venueName   String?
  websiteUrl  String?
  clubColors  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  area         Area?             @relation(fields: [areaId], references: [id], onDelete: SetNull)
  seasons      SeasonClub[]
  homeMatches  Match[]           @relation("HomeClub")
  awayMatches  Match[]           @relation("AwayClub")
  standings    Standing[]
  externalRefs ClubExternalRef[]
  posts        PostClub[]
}

model Match {
  id                String       @id @default(cuid())
  /// Денормалізовано з Season — для швидких фільтрів без join
  competitionId     String
  seasonId          String
  /// Нормалізований mapper-ом: REGULAR_SEASON, LEAGUE_STAGE, GROUP_STAGE, LAST_16, QUARTER_FINALS, SEMI_FINALS, FINAL, …
  stage             String       @default("REGULAR_SEASON")
  groupName         String?
  matchday          Int?
  kickoffAt         DateTime
  status            MatchStatus  @default(SCHEDULED)
  minute            Int?
  homeClubId        String
  awayClubId        String
  homeScore         Int?
  awayScore         Int?
  homeScoreHalfTime Int?
  awayScoreHalfTime Int?
  homePenalties     Int?
  awayPenalties     Int?
  winner            MatchWinner?
  venueName         String?
  likeCount         Int          @default(0)
  dislikeCount      Int          @default(0)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  competition   Competition        @relation(fields: [competitionId], references: [id], onDelete: Restrict)
  season        Season             @relation(fields: [seasonId], references: [id], onDelete: Restrict)
  homeClub      Club               @relation("HomeClub", fields: [homeClubId], references: [id], onDelete: Restrict)
  awayClub      Club               @relation("AwayClub", fields: [awayClubId], references: [id], onDelete: Restrict)
  commentThread CommentThread?
  likes         MatchLike[]
  externalRefs  MatchExternalRef[]

  @@index([seasonId, matchday])
  @@index([competitionId, kickoffAt])
  @@index([homeClubId, kickoffAt])
  @@index([awayClubId, kickoffAt])
  @@index([status])
  @@index([kickoffAt])
}

model Standing {
  id           String       @id @default(cuid())
  seasonId     String
  clubId       String
  stage        String       @default("REGULAR_SEASON")
  /// '' замість NULL — інакше @@unique не спрацює (NULL != NULL у Postgres)
  groupName    String       @default("")
  type         StandingType @default(TOTAL)
  position     Int
  played       Int          @default(0)
  won          Int          @default(0)
  drawn        Int          @default(0)
  lost         Int          @default(0)
  points       Int          @default(0)
  goalsFor     Int          @default(0)
  goalsAgainst Int          @default(0)
  goalDiff     Int          @default(0)
  /// "W,D,L,W,W"
  form         String?
  updatedAt    DateTime     @updatedAt

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  club   Club   @relation(fields: [clubId], references: [id], onDelete: Restrict)

  @@unique([seasonId, stage, groupName, type, clubId])
  @@index([seasonId, stage, groupName, type, position])
}

// ═════════════════════════════════════════
// SYNC (єдине місце, що знає про провайдерів)
// ═════════════════════════════════════════

model CompetitionExternalRef {
  provider      DataProvider
  externalId    String
  competitionId String
  lastSyncedAt  DateTime?
  /// Хеш нормалізованого payload — пропускаємо upsert, якщо нічого не змінилось
  payloadHash   String?

  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)

  @@id([provider, externalId])
  @@unique([provider, competitionId])
}

model SeasonExternalRef {
  provider     DataProvider
  externalId   String
  seasonId     String
  lastSyncedAt DateTime?
  payloadHash  String?

  season Season @relation(fields: [seasonId], references: [id], onDelete: Cascade)

  @@id([provider, externalId])
  @@unique([provider, seasonId])
}

model ClubExternalRef {
  provider     DataProvider
  externalId   String
  clubId       String
  lastSyncedAt DateTime?
  payloadHash  String?

  club Club @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@id([provider, externalId])
  @@unique([provider, clubId])
}

model MatchExternalRef {
  provider     DataProvider
  externalId   String
  matchId      String
  lastSyncedAt DateTime?
  payloadHash  String?

  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@id([provider, externalId])
  @@unique([provider, matchId])
}

/// Журнал синків + лок (partial unique на RUNNING у SQL)
model SyncRun {
  id           String       @id @default(cuid())
  provider     DataProvider
  scope        SyncScope
  /// Slug турніру (PL, CL)
  targetRef    String
  trigger      SyncTrigger
  status       SyncStatus   @default(RUNNING)
  startedAt    DateTime     @default(now())
  finishedAt   DateTime?
  /// { matchesUpserted, matchesSkipped, clubsUpserted, standingsRows, apiCalls }
  stats        Json?
  errorMessage String?

  @@index([provider, scope, targetRef, startedAt(sort: Desc)])
}
```

### 5.1 Ручний SQL (дописати в baseline-міграцію)

Prisma такого не виражає, тому додаємо руками після згенерованого SQL:

```sql
-- CommentThread: рівно одна ціль
ALTER TABLE "CommentThread"
  ADD CONSTRAINT "CommentThread_single_target_check"
  CHECK (num_nonnulls("postId", "matchId") = 1);

-- Match: різні клуби
ALTER TABLE "Match"
  ADD CONSTRAINT "Match_distinct_clubs_check"
  CHECK ("homeClubId" <> "awayClubId");

-- Post: опублікований має дату публікації
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_published_has_date_check"
  CHECK ("status" NOT IN ('PUBLISHED', 'SCHEDULED') OR "publishedAt" IS NOT NULL);

-- Рівно одна мова за замовчуванням
CREATE UNIQUE INDEX "Language_single_default_idx"
  ON "Language" ("isDefault") WHERE "isDefault" = true;

-- Один поточний сезон на турнір
CREATE UNIQUE INDEX "Season_single_current_idx"
  ON "Season" ("competitionId") WHERE "isCurrent" = true;

-- Лок: не більше одного RUNNING синку на (provider, scope, target)
CREATE UNIQUE INDEX "SyncRun_single_running_idx"
  ON "SyncRun" ("provider", "scope", "targetRef") WHERE "status" = 'RUNNING';
```

> ⚠️ Prisma не знає про ці індекси/CHECK. `prisma migrate dev` їх не видалить, але при **наступному squash** їх треба перенести знову — тому тримаємо копію в `apps/api/prisma/sql/constraints.sql`.

---

## 6. Синк: DB як джерело правди, провайдер — змінний

### 6.1 Архітектура `football/`

```
football/
  integration/
    football-provider.port.ts        ← інтерфейс FootballProvider + нейтральні типи (ProviderCompetition, ProviderMatch, …)
    football-data/
      football-data.client.ts        ← HTTP, ретраї, rate-limit (10 req/min free tier)
      football-data.mapper.ts        ← Fd* → Provider* (ЄДИНЕ місце, що знає формат football-data)
      football-data.provider.ts      ← implements FootballProvider
    football-integration.module.ts   ← провайдер через DI token FOOTBALL_PROVIDER
  persistence/
    football.repository.ts           ← доменні таблиці
    external-ref.repository.ts       ← resolve/upsert *ExternalRef батчами
    sync-run.repository.ts
  sync/
    football-sync.service.ts         ← працює ЛИШЕ з Provider* типами + ExternalRef
    football-live-throttle.service.ts← throttle з SyncRun (останній успішний LIVE), не in-memory
    football.cron.ts
  query/ …                           ← season-aware
```

### 6.2 Правила синку

1. **Нейтральні типи.** `FootballProvider` повертає `ProviderMatch { externalId: string; kickoffAt: Date; status: MatchStatus; stage: string; … }`. Sync-сервіс не бачить `Fd*`. Новий провайдер = новий адаптер + значення в `DataProvider`.
2. **Резолв id батчем.** `externalRefRepository.resolveClubIds(provider, externalIds[]) → Map<externalId, clubId>` одним запитом, а не upsert по одному.
3. **Власність полів.** Синк пише лише *provider-owned* поля (рахунок, статус, дата, назва, емблема). *Editorial* поля (`slug`, `isActive`, `sortOrder`, переклади, прив'язки постів) синк **ніколи** не перезаписує.
4. **Ідемпотентність і дельта.** `payloadHash` у `*ExternalRef`: якщо хеш не змінився, пропускаємо запис у БД (сотні матчів сезону → десятки реальних апдейтів).
5. **Транзакції по сторінці.** Сторінку матчів (50 шт.) пишемо в одній `$transaction`: або вся, або жодна.
6. **Standings замінюються атомарно** в межах `(seasonId, stage, groupName, type)`, а не всього турніру.
7. **SyncRun на кожен запуск.** Старт → `RUNNING` (partial unique = лок). Кінець → `SUCCEEDED` / `PARTIAL` / `FAILED` + `stats`. Адмінка показує останні запуски.
8. **Перехід сезону.** Синк бачить нового `currentSeason` у провайдера → створює `Season`, в одній транзакції знімає `isCurrent` зі старого й ставить на новий. Старі матчі й таблиці лишаються.
9. **Список турнірів** — `Competition where isActive` + їх `CompetitionExternalRef`. `FOOTBALL_COMPETITION_IDS` використовується лише в `seed.ts`.
10. **Ліміти free tier (10 req/хв).** ~5 запитів на турнір → повний синк 9 турнірів ≈ 5 хв. Повний синк — послідовно, раз на добу (cron); LIVE — лише активні турніри, в яких сьогодні є матчі.

### 6.3 Як розділені ліги й кубки

```
Competition (PL, LEAGUE)                        Competition (CL, CUP)
 ├ Season 2025/26 (isCurrent)                    └ Season 2025/26 (isCurrent)
 │  ├ SeasonClub × 20        ← склад ліги           ├ SeasonClub × 36
 │  ├ Standing (REGULAR_SEASON, TOTAL) × 20         ├ Standing (LEAGUE_STAGE, TOTAL) × 36   ← ліга-фаза
 │  └ Match × 380                                   └ Match: stage = LEAGUE_STAGE | PLAYOFFS | LAST_16 | … | FINAL
 └ Season 2026/27            ← окремо, не змішується
```

- **Таблиця ліги** = `Standing where seasonId = <поточний сезон>` (+ `stage`, `groupName`, `type`).
- **Клуби ліги** = `SeasonClub where seasonId = …` (а не `Club.leagueId`). Клуб може бути в PL і CL одночасно.
- **Кубки:** `Competition.type = CUP`. Групи / ліга-фаза → кілька наборів `Standing` в одному сезоні (`stage` + `groupName`). Плей-оф → `Match.stage`; UI будує сітку за стадіями.
- **Збірні (WC, EC):** `Club.kind = NATIONAL` (визначає mapper за даними провайдера); сезон-турнір з label `2026` / `2024`.
- **Вигляд сторінки за `type`:** LEAGUE → таблиця + тури; CUP → групи / ліга-фаза + сітка плей-оф.

**Чому НЕ таблиця на кожну лігу/кубок:**
- нова ліга = нова модель Prisma + міграція + новий репозиторій (суперечить D7: турнір = рядок у БД);
- неможливі наскрізні запити: «усі матчі Arsenal» (PL + CL + кубок), календар за датою;
- лайки/коментарі до матчу мали б FK на 9 різних таблиць;
- індекси `@@index([seasonId, …])` роблять вибірку однієї ліги такою ж швидкою, як окрема таблиця;
- якщо колись будуть мільйони матчів — Postgres LIST-partitioning `Match` за `competitionId` дає фізичне розділення при одній логічній таблиці. Зараз (~2.8k матчів) не потрібно.

### 6.4 Публічний API ліг

Префікс лишаємо `/football/leagues/...` (web не ламається); всередині — `Competition`.

| Endpoint | Відповідь |
|---|---|
| `GET /football/leagues` | `[{ slug, name, type, area, emblemUrl, currentSeason: { label } }]`, лише `isActive`, сортування `sortOrder` — для перемикача |
| `GET /football/leagues/:slug/clubs?season=` | клуби через `SeasonClub` |
| `GET /football/leagues/:slug/standings?season=` | `[{ stage, groupName, type, rows[] }]` |
| `GET /football/leagues/:slug/matches?season=&stage=` | матчі; для кубків — фільтр за стадією |
| `GET /football/leagues/:slug/dashboard` | форма незмінна для LEAGUE; для CUP `standings` = ліга-фаза / перша група |

`season` не передано → поточний (`isCurrent`).

---

## 7. Auth: refresh-сесії

**Логін:** генеруємо opaque refresh-токен (`crypto.randomBytes(32)`), у БД кладемо `sha256` + новий `familyId`. Cookie `refresh_token` з `path=/api/v1/auth`, `httpOnly`, `sameSite=lax`, `secure` на проді.

**`POST /auth/refresh`:**
1. Знайти сесію за хешем.
2. Якщо сесія не знайдена або прострочена → 401.
3. Якщо `revokedAt` вже стоїть → **reuse detected**: відкликати всю сім'ю (`familyId`) → 401.
4. Якщо `user.status = LOCKED` → 403.
5. Відкликати поточну сесію, створити нову з тим самим `familyId`, видати нові access і refresh.

**`POST /auth/logout`:** відкликати поточну сесію. Працює і без валідного access-токена: guard знімаємо, читаємо refresh cookie.

**`POST /auth/logout-all`:** відкликати всі сесії користувача.

**`GET /auth/me`:** користувач + профіль (відновлення сесії після F5).

**Frontend (`lib/api/http.ts` web + admin):** на 401 один раз викликати `/auth/refresh` (single-flight: паралельні запити чекають один refresh), потім повторити запит.

**Cron:** видаляти `AuthSession` з `expiresAt < now() - 7d` і `RateLimitEvent` старші за 24 год.

---

## 7.5 Видалення користувача і коментарів (не лише блокування)

> Причина розділу: `Post.author` і `Comment.author` мають `onDelete: Restrict` — фізичний `DELETE FROM "User"` для автора з постами/коментарями впаде на FK-обмеження. Блокування (`status = LOCKED`) забороняє вхід, але **не видаляє дані** — для запиту «видали мій акаунт» / скарги на конкретний коментар цього не досить.

### 7.5.1 Видалення користувача — анонімізація, не `DELETE` рядка (D19)

Рядок `User` **ніколи не видаляється фізично** — це одразу знімає проблему з `Restrict` на `Post.author`/`Comment.author`, без зміни FK-стратегії. «Видалення» = одна транзакція:

1. `email` → `deleted-<userId>@removed.invalid` (зберігає `@unique`, звільняє реальний email для повторної реєстрації)
2. `passwordHash` → значення, яке ніколи не пройде `bcrypt.compare` (наприклад, `''`)
3. `UserProfile.displayName` → `'Deleted user'`; `avatarUrl`, `bio` → `null`
4. `status = DELETED`, `deletedAt = now()`
5. Відкликати всі `AuthSession` користувача (`revokedAt = now()`)
6. Пости й коментарі **лишаються** (цілісність стрічки/тредів) — на фронті автор рендериться як «Видалений користувач», якщо `author.deletedAt` не `null`

Ендпоінти:
- `DELETE /users/me` — self-service, авторизований юзер видаляє свій акаунт (підтвердження паролем у DTO)
- `DELETE /users/:id` — **ADMIN**, той самий процес + запис `UserSanction(type: ACCOUNT_DELETED, issuedById: <admin>)` для аудиту (self-delete через `UserSanction` **не** логується — `deletedAt` і так є аудитом власної дії)

`JwtStrategy` / `AuthService.login`: `status = DELETED` блокує так само, як `LOCKED` (уже є перевірка `status`, просто додається друге значення).

### 7.5.2 Видалення коментаря — soft delete (є) + hard delete / purge (нове) (D20)

Різниця:
| | Soft delete (є, `deletedAt`) | Purge (нове) |
|---|---|---|
| Хто | автор коментаря або ADMIN | лише **ADMIN** |
| Що лишається | рядок у БД, контент ховається за `deletedAt` | рядок фізично видалено |
| Коли | звичайна модерація/самовидалення, зворотна дія можлива | legal takedown, GDPR-запит на конкретний коментар |
| Структура треду | не зачіпається (`parentId`/`rootId` цілі) | треба обійти `Comment.parent`/`Comment.root` (`onDelete: Restrict`) |

Ендпоінти:
- `DELETE /comments/:id` — **без змін**, лишається soft delete (автор/ADMIN)
- `DELETE /comments/:id/purge` — **ADMIN**, дозволено лише якщо `replyCount = 0` (коментар без активних відповідей); інакше — `409` з підказкою викликати `purge-thread`
- `DELETE /comments/:id/purge-thread` — **ADMIN**, видаляє коментар **разом з усією гілкою відповідей** (для спам/образливих тредів цілком). Сервісна логіка (`CommentRepository.purgeThread`):
  1. Вибрати всі нащадки (`rootId = id`) + сам `id`
  2. Відсортувати за `depth DESC` (найглибші — першими)
  3. В одній транзакції видаляти по одному від найглибших до кореня — на момент видалення батька його дітей уже немає, тож `Restrict` не спрацьовує
  4. `thread.commentCount -= purgedCount` у тій самій транзакції

Обидва purge-ендпоінти — явно деструктивні дії; у CLAUDE.md/адмінці позначити окремим підтвердженням (не плутати зі звичайним "Delete").

---

## 8. Контент: мови і fallback

- `Language` seed: `en` (isDefault), `ua`.
- **Запит `?lang=xx`:** беремо переклад `xx`, інакше переклад мови `isDefault`. У відповіді повертаємо `resolvedLanguage`, щоб UI міг показати «Переклад недоступний» і правильний `lang` атрибут.
- **Невідома або неактивна мова** в `lang` → default, без 400.
- **Створення поста:** EN обов'язковий (валідація в сервісі: є переклад мови `isDefault`), решта опційні.
- **`slug`:** один, генерується з EN-заголовка, не змінюється після публікації.
- **SEO:** `hreflang` лише для мов, де є переклад; для решти — `canonical` на EN-версію.
- **Стрічка:** `status = PUBLISHED AND deletedAt IS NULL AND publishedAt <= now()` → `ORDER BY publishedAt DESC`.
- **`SCHEDULED`:** cron (або перевірка `publishedAt <= now()` у запиті) — достатньо фільтра, окремий job не обов'язковий.

---

## 9. Спроєктовано, але НЕ створюємо зараз (адитивно)

| Сутність | Етап | Як ляже |
|---|---|---|
| `Player`, `PlayerExternalRef`, `SquadMember { seasonId, clubId, playerId, shirtNumber, position }` | 7.4 | Нові таблиці, прив'язка до `Season` вже є |
| `MatchEvent { matchId, minute, type (GOAL/CARD/SUB), clubId, playerId? }` | 15 | Нова таблиця |
| `ClubTranslation`, `CompetitionTranslation` | за потреби | Нові таблиці + fallback на `Club.name` |
| `PostPlayer`, `PostMatch` | за потреби | Як `PostClub` |
| `CommentThread.clubId` / `playerId` | за потреби | Nullable колонка + оновити CHECK |
| `ContentReport { reporterId, commentId, reason, status }` | 16 | Нова таблиця |
| `MatchPrediction { userId, matchId, homeScore, awayScore, points }` | після MVP | Нова таблиця |
| `UserFavoriteClub { userId, clubId }` | 10 | Нова таблиця |
| `AuthAccount { provider, providerAccountId, userId }` (OAuth) | за потреби | Нова таблиця; `passwordHash` → nullable |
| `MediaAsset` (Cloudinary, alt по мовах) | 14+ | Нова таблиця; `coverImageUrl` лишається як кеш |
| `PostRevision` | за потреби | Нова таблиця |

---

## 10. Фази виконання

> Гілка: `refactor/schema-v5`. Кожна фаза — окремий коміт (Conventional Commits). Після кожної фази: `pnpm build` + ручна перевірка.

> ⚠️ **Збірка API червона з Фази 1 до кінця Фази 5 — це очікувано.** Фаза 1 міняє `schema.prisma` → `prisma generate` дає типи v5, а код модулів ще на полях v4 (`accountLockedAt`, `password`, `leagueId`, `published`, `language`, `externalId` … — ~15 файлів у `auth/`, `security/`, `posts/`, `comments/`, `likes/`, `football/`). Кожна фаза лагодить свої модулі.
> - **Перевірка фаз 1–5** замість `pnpm build`: `pnpm --filter @football-portal/api exec tsc --noEmit -p tsconfig.build.json` — **0 помилок у модулях поточної фази**, загальна кількість помилок лише зменшується (записувати число в коміт).
> - **Після Фази 5** — `pnpm build` (усі 3 застосунки) знову зелений; з Фази 6 правило «після кожної фази `pnpm build`» діє як раніше. Відкочувати нічого не треба: зміни Фази 0 (`src/prisma/`, `tsconfig.build.json` з `rootDir: ./src`, pnpm-guard) — постійні.
> - `master` не чіпаємо, поки гілка не зелена; merge — лише після Фази 7.

### Фаза 0 — Підготовка ✅ (2026-09-26)
- [x] `pg_dump` поточної dev-БД (Supabase) → зберегти поза репо — `~/Desktop/football/db-backups/football-portal-dev-20260926-001215.{dump,sql}` (схема `public`, `--no-owner --no-privileges`; pg_dump 18.6 з `brew libpq`, сервер 17.6). Відновлення: `pg_restore --no-owner -d <url> <file>.dump`
- [x] `apps/api/scripts/export-content.ts` (лише читання): адмін (`email`, `name`, `password` → `passwordHash`, `role`) + пости з перекладами й тегами → `apps/api/prisma/seed-data/content.json`. Запуск: `pnpm db:export-content`. Одна транзакція `READ ONLY` + `REPEATABLE READ`; формат уже в термінах v5, зв'язки через `authorEmail` / `tagSlugs`; валідація: EN-переклад + автор-адмін. Результат: 1 адмін, 3 пости, 6 перекладів, 0 тегів
- [x] `prisma/seed-data/` → `.gitignore` (містить хеш пароля)
- [x] Попутні фікси (постійні, не відкочувати): `PrismaModule`/`PrismaService` → `src/prisma/`; `tsconfig.build.json` — `include: ["src"]`, `rootDir: ./src`, `tsBuildInfoFile` у `dist` (тепер `dist/main.js`, `start:prod` працює); pnpm-only guard (`.npmrc` `engine-strict` + `engines.npm`), `package-lock.json` прибрано
- [x] Коментарі, лайки, другий користувач — **не** зберігаються
- [x] Гілка `refactor/schema-v5`

### Фаза 1 — Схема + baseline-міграція + seed ✅ (2026-09-26)
- [x] Замінити `schema.prisma` на v5 (розділ 5) — 31 таблиця, 17 enum-ів, `ON DELETE` звірено з розділом 5
- [x] `apps/api/prisma/sql/constraints.sql` (розділ 5.1)
- [x] Squash міграцій (розділ 11): видалено 4 dev-міграції, `0001_init` = `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` (без shadow-БД) + `constraints.sql`
- [x] `prisma migrate reset` на dev-БД
- [x] `prisma/seed.ts` + `migrations.seed` у `prisma.config.ts` (Prisma 7 **не** запускає seed автоматично після `reset` → `pnpm db:seed`). Ідемпотентний (upsert з `update: {}` — editorial-поля не перезаписує), одна транзакція, валідація `content.json` до запису:
  - мови: `en` (default), `ua`
  - адмін і пости з `seed-data/content.json` (автор = адмін, `status = PUBLISHED`, `publishedAt = createdAt`); якщо файлу немає — адмін з `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
  - усі 9 турнірів як `Competition` + `CompetitionExternalRef` (`provider = FOOTBALL_DATA`), `isActive = true`:

    | slug | externalId | type | sortOrder |
    |---|---|---|---|
    | PL | 2021 | LEAGUE | 1 |
    | PD | 2014 | LEAGUE | 2 |
    | SA | 2019 | LEAGUE | 3 |
    | BL1 | 2002 | LEAGUE | 4 |
    | FL1 | 2015 | LEAGUE | 5 |
    | PPL | 2017 | LEAGUE | 6 |
    | CL | 2001 | CUP | 10 |
    | WC | 2000 | CUP | 20 |
    | EC | 2018 | CUP | 21 |

  - після seed — повний синк з адмінки → **перенесено у Фазу 5** (sync-код ще на v4, API не компілюється)
- [x] Перевірка: `prisma migrate status` чистий, `prisma generate` без помилок; `migrate diff` БД → схема порожній (Prisma ігнорує наші CHECK / partial-індекси — не намагається їх видалити); повторний seed без дублів
- [x] Обмеження розділу 5.1 перевірено в транзакції з `ROLLBACK`: друга default-мова, `PUBLISHED` без `publishedAt`, `CommentThread` з 0 / 2 цілями, два `RUNNING` `SyncRun`, `DELETE` автора постів — усі падають. Також перевірено: каскадне видалення треду з вкладеними відповідями не падає на `RESTRICT` самопосилань `Comment`
- [x] Результат seed: 2 мови, 1 адмін (хеш пароля = експорт; логін перевіримо у Фазі 2 — API не компілюється), 3 пости `PUBLISHED` (en+ua), 9 турнірів + `CompetitionExternalRef`
- [x] `tsc --noEmit -p tsconfig.build.json`: 0 → **81** помилка (auth 11, comments 23, football 25, likes 12, posts 10) — очікувано, лагодиться у Фазах 2–5
- [x] Після успішного seed (адмін логіниться, 3 пости видно в БД): **видалити** `apps/api/scripts/export-content.ts` і скрипт `db:export-content` з `apps/api/package.json` — він написаний під типи v4 і після зміни схеми вже не компілюється. `prisma/seed-data/content.json` лишається (gitignored) — це вхід для `seed.ts`; бекап у `~/Desktop/football/db-backups/` — страховка, якщо щось піде не так

### Фаза 2 — Identity + Moderation

> **Розбита на 5 підфаз** (кожна = окремий коміт, можна в окремому чаті). Порядок: 2a → 2b → 2c → 2d; 2e залежить лише від контракту 2b. Новий чат: «Фаза 2x з `football-plan-intermediate.md`» — усе потрібне нижче.
> **Гілка:** `refactor/schema-v5` (перестворена 2026-09-26 від `master` = `43840d7`, куди squash-змерджено Фази 0–1).

#### 2.0 Контекст (аналіз коду, 2026-09-26)

Стан до Фази 2 (`tsc --noEmit -p tsconfig.build.json` = **81** помилка):

| Файл | Помилок | Що зламано (поля v4) | Підфаза |
|---|---|---|---|
| `auth/auth.service.ts` | 8 | `name`, `password`, `accountLockedAt` | 2a |
| `auth/strategies/jwt.strategy.ts` | 3 | `name`, `accountLockedAt` | 2a |
| `likes/like-anti-abuse.service.ts` | 11 | `likesSuspendedUntil`, `likeAbuseStrikes`, `likeBurstLog` | 2c |
| `comments/comment-anti-abuse.service.ts` | 13 | `commentsSuspendedUntil`, `lastCommentAt`, `commentBurstLog` | 2c |
| `comments/comment.service.ts:70` | 1 з 3 | `tx.user.update({ lastCommentAt })` — прибрати (cooldown → `RateLimitEvent`) | 2c |
| решта (`posts`, `comments`, `likes`, `football`) | — | — | Фази 3–5 |

Поточний auth (v4): `AuthController` сам ставить cookies; `refresh_token` — JWT з тим самим payload, без `path`, ніде не зберігається; `POST /auth/refresh` немає; `logout` під `JwtAuthGuard` лише чистить cookies. `req.user` у контролерах використовується лише як `{ id, role }` (posts, comments, likes) — `name`/`email` у `req.user` нікому не потрібні.

Frontend: web `lib/api/http.ts` і admin `lib/api/http.ts` кидають `new Error(message)` без статусу; `useAuthStore.user` заповнюється лише в `LoginForm`/`AdminLoginForm` → після F5 сесія «губиться». Автор рендериться як `author.name` у `HomeFeed.tsx`, `news/[slug]/NewsPostView.tsx`, `components/comments/CommentThreadNode.tsx`, admin `dashboard/posts/page.tsx`. Типи — `packages/types/index.ts` (`User`, `Post.author`, `Comment.author` з `avatar?`).

#### 2.1 Рішення, прийняті при аналізі (доповнюють розділи 7 і 7.5)

| # | Рішення | Чому |
|---|---|---|
| P2-1 | Access-JWT payload = `{ sub, role }`; `JwtStrategy` вибирає лише `id, role, status`, `status !== ACTIVE` → 401 | Менше даних у токені; `req.user` = `{ id, role }` — усе, що потрібно контролерам |
| P2-2 | `login`: `status` перевіряємо **після** пароля; для неіснуючого email — `bcrypt.compare` з фіктивним хешем | Не розкривати факт блокування / існування email по коду чи часу відповіді |
| P2-3 | `refresh`: знайти сесію → прострочена/нема → 401 → **статус юзера** (LOCKED → 403, DELETED → 401) → лише потім `revokedAt` | Інакше блокування (яке відкликає всі сесії) виглядає як хибний «reuse detected» |
| P2-4 | Ротація атомарна: `updateMany({ where: { id, revokedAt: null } })` + перевірка `count === 1` | Два паралельні refresh одним токеном не створять дві сесії |
| P2-5 | Гонка вкладок: токен відкликано < 30 с тому **і** в сім'ї є живий наступник → `409 REFRESH_SUPERSEDED` без відкликання сім'ї; фронт повторює запит (cookie вже оновила інша вкладка). Інакше — reuse → відкликати сім'ю → 401 + `Logger.warn` | Дві вкладки не мають розлогінювати користувача |
| P2-6 | Refresh-сесія — ковзне вікно 7 днів (нова сесія при ротації = `now + 7d`) | Активний користувач не вилітає; неактивний — через 7 днів |
| P2-7 | Логін/логаут також чистять legacy cookie `refresh_token` з `path=/` (v4) | Інакше старий JWT-cookie лишається в браузерах назавжди |
| P2-8 | Репозиторії приймають `db: Prisma.TransactionClient` (патерн уже є — `CommentRepository.createWithTx`); транзакцію відкриває сервіс | Бізнес-транзакції через кілька репозиторіїв без порушення правила «repository = Prisma only» |
| P2-9 | Anti-abuse: один спільний сервіс у `security/` з політиками по дії (`RateLimitAction` → поріг, вікно, тип санкції, тривалість, код помилки); Like/Comment anti-abuse — тонкі обгортки (публічні методи не міняються) | Дві копії однієї логіки → одна |
| P2-10 | Видача санкції — у транзакції під `pg_advisory_xact_lock(hashtext(userId || ':' || action))` + перевірка «вже є активна» | Burst = паралельні запити; без локу 5 запитів дають кілька санкцій і одразу блок акаунта |
| P2-11 | `RateLimitEvent` після санкції **не** видаляємо (у v4 видаляли burst-лог); strikes = `count` **невідкликаних** санкцій типу | Cooldown рахується з цих подій; відкликана адміном санкція — не strike |
| P2-12 | Anti-abuse **не** перевіряє блок акаунта | Це вже робить `JwtStrategy` на кожному запиті |
| P2-13 | Публічний автор = `{ id, name, avatarUrl, isDeleted }` (замість `deletedAt` з 7.5.1); `name` = `UserProfile.displayName`. Спільні `PUBLIC_AUTHOR_SELECT` + `toPublicAuthor()` у `users/` — Фази 3–4 використовують їх у posts/comments | Не світимо дату видалення; фронт локалізує «Видалений користувач» за прапорцем |
| P2-14 | Адміна через API не видаляємо (ні `/users/me`, ні `/users/:id`) → 403 | Захист від стану «жодного адміна» |
| P2-15 | `DELETE /users/me` з тілом `{ password }`; web `apiDelete` отримує опційне `body` | Підтвердження паролем (7.5.1) |

#### 2a — Identity core ✅ (2026-09-26)
- [x] Видалити `apps/api/scripts/export-content.ts` + `db:export-content` (хвіст Фази 1)
- [x] `users/`: `UsersModule`, `UserRepository` (`findCredentialsByEmail`, `findAccountById`, `findAccessById`, `createWithProfile`), `user-account.ts` (`toUserAccount` → `{ id, email, role, name, avatarUrl }` — форма `user` у відповідях auth), `public-author.ts` (`PUBLIC_AUTHOR_SELECT`, `toPublicAuthor`, `PublicAuthor`) — поки не використовується, для Фаз 3–4
- [x] `AuthService.register`: User + `UserProfile.displayName` одним nested create, `P2002` → 409 (без попереднього `findUnique` — немає гонки)
- [x] `AuthService.login`: `passwordHash`, P2-2. `LOCKED` → 403 лише з правильним паролем; `DELETED` → 401. Профіль вантажиться **після** пароля: relation у Prisma = окремий запит, і він давав ~50 мс різниці «email є / нема»; тепер обидві гілки ≈ 0.10 с
- [x] DTO: `@Transform(trim)` на email (раніше `" a@b.c "` падав на `@IsEmail` до нормалізації); `RegisterDto` — `MaxLength` (email 254, name 50, password 72); `LoginDto.password` — 256 (bcrypt сам обрізає до 72)
- [x] `JwtStrategy`: P2-1, `req.user` = `AuthenticatedUser { id, role }`; `status !== ACTIVE` → 401 (`ACCOUNT_LOCKED` для LOCKED)
- [x] `AuthService.refreshTokens` (v4, не був підключений) видалено; `generateTokens` поки видає refresh-JWT — замінюється у 2b
- [x] Перевірка — мінімальний Nest-застосунок лише з `PrismaModule` + `AuthModule` (повний API ще не збирається), `curl`: реєстрація (профіль створено), дубль у іншому регістрі/з пробілами → 409, name > 50 → 400, неправильний пароль / невідомий email → 401, логін → 200 + cookies, LOCKED: access-токен → 401 `ACCOUNT_LOCKED`, логін → 403, неправильний пароль → 401; DELETED → 401. Тестового юзера видалено
- [x] Логін адміна `test@test.com` з seed → 200, `role: ADMIN`, `name: "Test User"`; захищений роут з його access-токеном → 200 (хеш з експорту Фази 0 пережив міграцію)
- [x] `tsc`: 81 → **70** (auth 0, users 0)

#### 2b — Refresh-сесії
- [ ] `AuthSessionRepository` (create, findByTokenHash, rotate, revoke, revokeFamily, revokeAllForUser, deleteExpired)
- [ ] Opaque refresh (`randomBytes(32)`, у БД `sha256`), `userAgent`/`ipAddress`; P2-3…P2-7
- [ ] `POST /auth/refresh`, `POST /auth/logout` (без guard, за refresh-cookie), `POST /auth/logout-all` (guard), `GET /auth/me` (user + profile)
- [ ] Cookie-хелпери (`auth-cookies.ts`): `refresh_token` з `path=/api/v1/auth`
- [ ] Перевірка `curl`: ротація, reuse → відкликано сім'ю, гонка → 409, logout, logout-all, me

#### 2c — Moderation
- [ ] `security/`: `SecurityModule`, `UserSanctionRepository`, `RateLimitRepository`, спільний anti-abuse (P2-9…P2-12)
- [ ] `LikeAntiAbuseService`, `CommentAntiAbuseService` → обгортки; прибрати `lastCommentAt` з `comment.service.ts`
- [ ] `AccountModerationService.lockAccount`: `status = LOCKED` + `lockedAt` + `UserSanction(ACCOUNT_LOCKED)` + відкликати всі `AuthSession` — одна транзакція
- [ ] Cron: `AuthSession` з `expiresAt < now() - 7d`; `RateLimitEvent` старші за 24 год
- [ ] Перевірка: 0 помилок у `*-anti-abuse.service.ts`; burst → санкція → другий strike → LOCKED (SQL)

#### 2d — Видалення акаунта (розділ 7.5.1)
- [ ] `UserService.deleteAccount`: анонімізація + `status = DELETED` + `deletedAt` + відкликати сесії — одна транзакція
- [ ] `DELETE /users/me` (P2-15, чистить cookies), `DELETE /users/:id` (ADMIN, + `UserSanction(ACCOUNT_DELETED, issuedById)`), P2-14
- [ ] Перевірка `curl`: логін неможливий, email звільнений (повторна реєстрація), сесії відкликані

#### 2e — Frontend
- [ ] `packages/types`: `PublicAuthor`, `User` (`avatarUrl`), `Post.author`/`Comment.author` → `PublicAuthor`
- [ ] web + admin `http.ts`: `ApiError { status }`; refresh-on-401 single-flight (лише в браузері; не для `/auth/login|register|refresh`; `409` від refresh = успіх, P2-5)
- [ ] web: `useAuthQuery` (`GET /auth/me`, 401 → `null`) + синхронізація з `useAuthStore`; login/logout оновлюють кеш
- [ ] Рендер «Видалений користувач» за `author.isDeleted` (4 місця з 2.0) — наживо перевіряється після Фаз 3–4, коли posts/comments віддають `PublicAuthor`
- [ ] Перевірка: F5 зберігає сесію; після 15 хв запит проходить через refresh

### Фаза 3 — Content
- [ ] `PostRepository`: фільтр і сортування за `status`/`publishedAt`; `select` з `translations` + fallback на default-мову, `resolvedLanguage` у відповіді
- [ ] DTO: `status`, `publishedAt?`, `languageCode` (валідується проти активних `Language`), `tagIds?`, `clubIds?`, `competitionIds?`
- [ ] Сервіс: обов'язковий переклад default-мови; при `PUBLISHED` без `publishedAt` → `now()`
- [ ] Tag: `TagTranslation` у відповіді з fallback
- [ ] Admin: поле статусу (Draft / Published / Scheduled + дата) замість чекбокса `published`
- [ ] Web: `resolvedLanguage` → позначка «Translation not available»

### Фаза 4 — Engagement
- [ ] `CommentThreadRepository.getOrCreateForPost/Match` (upsert за `postId`/`matchId`)
- [ ] `CommentService.create`: `threadId`, `rootId` = `parent.rootId ?? parent.id`, `depth` = `parent.depth + 1` (ліміт `MAX_COMMENT_THREAD_DEPTH`), інкремент `parent.replyCount` і `thread.commentCount` в одній транзакції; перевірка `thread.isLocked`
- [ ] Прибрати рекурсивний `depthFromRoot`
- [ ] Soft delete: декремент `commentCount`
- [ ] Hard delete / purge (розділ 7.5.2): `CommentRepository.purge(id)` (лише `replyCount = 0`, інакше `409`) і `purgeThread(id)` (нащадки за `rootId`, сортування `depth DESC`, видалення в транзакції найглибші → корінь, декремент `thread.commentCount` на `purgedCount`)
- [ ] `DELETE /comments/:id/purge` і `DELETE /comments/:id/purge-thread` — **ADMIN only**
- [ ] `LikeRepository`: `UserReactionActivity` з enum-ами
- [ ] API-контракт коментарів для web не змінювати (дерево як зараз)

### Фаза 5 — Football + Sync
- [ ] `football-provider.port.ts` + адаптер `football-data/` (розділ 6.1); mapper → нейтральні типи, `stage`/`groupName`/half-time/penalties/winner
- [ ] Mapper: `seasonLabelFromFd` → `"2026"`, якщо рік старту = рік кінця; `ClubKind.NATIONAL` для збірних
- [ ] `ExternalRefRepository` (batch resolve + upsert з `payloadHash`)
- [ ] `SyncRunRepository` + лок
- [ ] `FootballSyncService`: Area → Competition → Season (з переходом `isCurrent`) → Clubs + `SeasonClub` → Matches (посторінково, транзакції, дельта) → Standings (по групах/типах)
- [ ] Список турнірів з `Competition.isActive`
- [ ] `FootballLiveThrottleService` → на основі `SyncRun`
- [ ] `FootballRepository`/`QueryService`: усі запити через поточний сезон (`isCurrent`), опційний `?season=2025-26`
- [ ] Публічні endpoint-и ліг за розділом 6.4; `GET …/dashboard` — **зберегти форму відповіді** (web-сайдбар без змін), додати `season { label }`
- [ ] Адмінка: список останніх `SyncRun` на дашборді
- [ ] Web: нові `MatchStatus` (`PAUSED` → «HT», `SUSPENDED`, `AWARDED`) у перекладах; `date` → `kickoffAt`

### Фаза 5b — Web: перемикач ліг (мінімум; повні сторінки — етап 7.1)
- [ ] `components/football/FootballSidebar.tsx`: селектор ліг з `GET /football/leagues` (запит уже є в `hooks/useFootball.ts`), іконка + назва, групування «Ліги» / «Кубки» за `type`
- [ ] Обрана ліга — у query-параметрі `?league=` (SSR-сумісно, працює з prefetch на головній); дефолт — `resolveDefaultLeagueSlug.ts` (env або перша за `sortOrder`)
- [ ] Для CUP у сайдбарі — таблиця ліга-фази / першої групи + найближчі матчі

### Фаза 6 — Типи, документація
- [ ] `packages/types`: `Post.status`/`publishedAt`/`coverImageUrl`, `resolvedLanguage`, `author.profile` або пласке `author { id, displayName, avatarUrl }`, `Match.kickoffAt`
- [ ] `CLAUDE.md`: Database-секція → v5, Auth-секція (refresh)
- [ ] Основний план: див. розділ 12

### Фаза 7 — Перевірка
- [ ] Реєстрація → логін → через 15 хв запит проходить (refresh) → logout → старий refresh-токен дає 401
- [ ] Повторне використання старого refresh → вся сім'я відкликана
- [ ] 5 лайків за 5 с → `UserSanction(LIKES_SUSPENDED)`; другий раз → `LOCKED`, сесії відкликані
- [ ] `DELETE /users/me` для автора постів/коментарів не падає на FK (Restrict); email анонімізовано, повторна реєстрація тим самим email проходить; старі пости/коментарі рендерять «Видалений користувач»
- [ ] `DELETE /comments/:id/purge` на коментар з `replyCount > 0` → `409`; на листковий коментар → рядок реально зникає з БД
- [ ] `DELETE /comments/:id/purge-thread` на гілку з 3+ вкладеними відповідями → усі рядки видалено, `thread.commentCount` зменшено коректно
- [ ] Пост DRAFT не видно на web; PUBLISHED видно; `?lang=ua` без UA-перекладу → EN + позначка
- [ ] Синк `PL` + `CL`: клуб в обох турнірах, `SeasonClub` в обох, таблиці не перетирають одна одну
- [ ] Після повного синку: `SeasonClub` поточного сезону = кількість команд турніру (PL 20, PD 20, SA 20, BL1 18, FL1 18, PPL 18, CL 36); жоден клуб не «зникає» з ліги після синку CL
- [ ] PL: матчі 2025/26 і 2026/27 у різних `Season`; сайдбар показує лише `isCurrent`
- [ ] WC/EC: `Club.kind = NATIONAL`, label `2026` / `2024`
- [ ] Перемикач у сайдбарі: зміна ліги міняє таблицю й тури; `?league=CL` відкривається напряму
- [ ] Повторний синк без змін → `stats.matchesSkipped` ≈ всі
- [ ] Два паралельні синки одного турніру → другий відхилено (лок)
- [ ] Коментар на матчі й на пості → `CommentThread` створюється; вставка з обома ціль-полями падає на CHECK

---

## 11. Міграції: squash до релізу

**Поки немає прод-БД**, історію міграцій можна схлопувати скільки завгодно:

```bash
cd apps/api
rm -rf prisma/migrations/2026*            # migration_lock.toml лишити
pnpm prisma migrate reset --force        # скинути dev-БД
pnpm prisma migrate dev --name init --create-only
# дописати в prisma/migrations/<ts>_init/migration.sql вміст prisma/sql/constraints.sql
pnpm prisma migrate dev                   # застосувати
pnpm prisma db seed
```

> Для Supabase `migrate` йде через `DIRECT_URL` (вже в `prisma.config.ts`).

**Правило:** squash дозволений до першого деплою на прод (етап 14). Останній squash — безпосередньо **перед** релізом. Тоді прод стартує з однієї `0001_init`.

**Після релізу:**
- застосовані міграції **ніколи** не редагуємо й не видаляємо;
- структурні зміни — expand → backfill → contract (3 окремі міграції/деплої);
- кожну міграцію генеруємо з `--create-only` і читаємо SQL (Prisma любить `DROP` + `ADD` замість `RENAME`);
- `pg_dump` перед кожним `migrate deploy` на проді.

---

## 12. Що перенести в основний план після виконання

- [ ] **Частина 2:** замінити схему v4.0 на v5 (або посилання на `schema.prisma`) + таблиця рішень D1–D18
- [ ] **«Prisma та міграції»:** правила з розділу 11
- [ ] **Етап 4.4 (новий):** «Schema v5 refactor» ✅
- [ ] **Етап 6 (лайки):** відмітити виконане (backend `likes/` + `LikeBar`, `useLikes` вже є в коді); анти-абуз → `UserSanction`/`RateLimitEvent`
- [ ] **Етап 7:** маршрути з урахуванням сезону (`/leagues/[slug]?season=2025-26`); вигляд сторінки ліги за `Competition.type` (LEAGUE → таблиця + тури, CUP → групи + сітка плей-оф); перемикач у сайдбарі — виконано у Фазі 5b; новини ліги/клубу через `PostCompetition`/`PostClub`; 7.4 — `Player`/`SquadMember` з розділу 9
- [ ] **Етап 8:** коментарі на матчі через `CommentThread`
- [ ] **Етап 9:** теги з `TagTranslation`
- [ ] **Етап 10 (профіль):** «Видалити акаунт» (`DELETE /users/me`) — див. розділ 7.5.1
- [ ] **Етап 11 (адмінка):** статуси постів, керування `Competition.isActive`, журнал `SyncRun`, ручні санкції, **видалення акаунта** (`DELETE /users/:id`) і **purge коментаря / purge-thread** — див. розділ 7.5
- [ ] **Етап 16:** `ContentReport`
- [ ] **Polish:** `GET /auth/me` + refresh — виконано у Фазі 2
- [ ] **«Контекст для AI»** і `CLAUDE.md` — оновити
