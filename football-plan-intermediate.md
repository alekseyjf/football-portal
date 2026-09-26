# 🧱 Football Portal — Intermediate Plan: Schema v5

> **Статус:** ◐ у процесі — Фази 0–3 ✅ (2a–2f, 3a), далі Фаза 4
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
MODERATION    UserSanction · RateLimitEvent · BlockedEmail
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

/// Додано у 2d (P2-19)
enum EmailBlockReason {
  ACCOUNT_DELETED_BY_ADMIN
  ACCOUNT_SELF_DELETED
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
  familyId        String
  /// Старт сім'ї (логін) — абсолютний ліміт 30 д (2f)
  familyStartedAt DateTime
  tokenHash       String    @unique
  userAgent       String?
  ipAddress       String?
  /// min(ротація + 7 д, familyStartedAt + 30 д)
  expiresAt       DateTime
  lastUsedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  /// sid у access-токені: JwtStrategy шукає живу сесію сім'ї на кожен запит (2f)
  @@index([familyId, revokedAt])
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

/// Пошта видаленого акаунта (2d, P2-19). Лише HMAC канонічної адреси, без FK на User.
model BlockedEmail {
  id           String           @id @default(cuid())
  emailHash    String           @unique
  reason       EmailBlockReason
  /// null = безстроково
  blockedUntil DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([blockedUntil])
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

-- User: .invalid — лише анонімізовані акаунти, у форматі deleted-<id>@removed.invalid (2d, P2-17)
ALTER TABLE "User"
  ADD CONSTRAINT "User_reserved_email_check"
  CHECK (
    CASE WHEN "status" = 'DELETED'
      THEN "email" = 'deleted-' || "id" || '@removed.invalid'
      ELSE lower("email") NOT LIKE '%.invalid'
    END
  );
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

**2f:** access-JWT несе `sid` = `familyId`; `JwtStrategy` на кожен запит перевіряє, що сім'я жива → logout / logout-all / блокування гасять access одразу. Сесія живе не довше 30 днів від логіну (`familyStartedAt`), ковзне вікно 7 д — лише всередині. Адмінка логіниться через `POST /auth/login/admin` (не-ADMIN → 403 до створення сесії).

**Frontend (`lib/api/http.ts` web + admin):** на 401 один раз викликати `/auth/refresh` (single-flight: паралельні запити чекають один refresh), потім повторити запит.

**Cron:** видаляти `AuthSession` з `expiresAt < now() - 7d` і `RateLimitEvent` старші за 24 год.

---

## 7.5 Видалення користувача і коментарів (не лише блокування)

> Причина розділу: `Post.author` і `Comment.author` мають `onDelete: Restrict` — фізичний `DELETE FROM "User"` для автора з постами/коментарями впаде на FK-обмеження. Блокування (`status = LOCKED`) забороняє вхід, але **не видаляє дані** — для запиту «видали мій акаунт» / скарги на конкретний коментар цього не досить.

### 7.5.1 Видалення користувача — анонімізація, не `DELETE` рядка (D19)

Рядок `User` **ніколи не видаляється фізично** — це одразу знімає проблему з `Restrict` на `Post.author`/`Comment.author`, без зміни FK-стратегії. «Видалення» = одна транзакція:

1. `email` → `deleted-<userId>@removed.invalid` (зберігає `@unique`). Справжня адреса **не звільняється**: її HMAC іде в `BlockedEmail` — admin-видалення блокує назавжди, self — на 30 днів (P2-19)
2. `passwordHash` → значення, яке ніколи не пройде `bcrypt.compare` (наприклад, `''`)
3. `UserProfile.displayName` → `'Deleted user'`; `avatarUrl`, `bio` → `null`
4. `status = DELETED`, `deletedAt = now()`
5. ~~Відкликати~~ **Видалити** всі `AuthSession` користувача (P2-16, 2d: у сесіях IP / user-agent)
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
- **Стрічка:** `status IN (PUBLISHED, SCHEDULED) AND deletedAt IS NULL AND publishedAt <= now()` → `ORDER BY publishedAt DESC` (виправлено у Фазі 3, P3-1: з `status = PUBLISHED` запланований без cron-а не виходив би ніколи).
- **`SCHEDULED`:** достатньо фільтра вище — статус у БД лишається `SCHEDULED`, окремий job не потрібен.

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
| P2-16 | Видалення акаунта **видаляє** `AuthSession` (а не відкликає, як у 7.5.1 п. 5) | У сесіях `ipAddress` / `userAgent` — персональні дані; для DELETED-власника refresh і так 401 |
| P2-17 | Реєстрація на TLD `.invalid` → 400 | `PublicAuthor.id` публічний: інакше можна заздалегідь зайняти `deleted-<id>@removed.invalid` жертви й зламати їй видалення на `@unique` email |
| P2-18 | Неправильний пароль у `DELETE /users/me` → **403** `INVALID_PASSWORD`, не 401 | 401 фронт (2e) трактує як прострочений access → refresh + повтор, хоча сесія жива |
| P2-19 | Пошта видаленого акаунта блокується для нової реєстрації: admin → безстроково, self → 30 днів; `register` → **403 `EMAIL_BLOCKED`**. У БД (`BlockedEmail`) лише HMAC-SHA256 канонічної адреси (`EMAIL_HASH_SECRET`), без FK на User | Забанений не повертається з тією ж поштою; self-delete не скидає санкції миттєвою перереєстрацією, але й не забирає пошту назавжди. Сирий email не зберігаємо (GDPR); окремий код — свідомий вибір (видно, що пошта заблокована) |
| P2-20 | Канонізація для блоклиста: без `+tag`, для gmail/googlemail — без крапок | Інакше блок обходиться через `user+1@…` / `u.s.e.r@gmail.com`. Лише для блоклиста — акаунти зберігають адресу як є |
| P2-21 | Ліміти запитів (`@nestjs/throttler`, пам'ять процесу) лише на auth-роутах, не глобально; два ліміти — на IP і на акаунт | Глобальний ліміт на IP душив би SSR (усі запити Next.js з одного IP). Ліміт лише на IP не зупиняє розподілений перебір одного акаунта |

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

#### 2b — Refresh-сесії ✅ (2026-09-26)
- [x] `auth/sessions/`: `AuthSessionRepository` (`create`, `findByTokenHash`, `rotate`, `findActiveInFamily`, `revokeByTokenHash`, `revokeFamily`, `revokeAllForUser`, `deleteExpired`) в окремому `AuthSessionsModule` — його імпортуватимуть `security/` (2c) і `users/` (2d) без циклу з `AuthModule`. `create` і `revokeAllForUser` приймають `db` (P2-8)
- [x] `AuthSessionService`: `startSession` (логін, нова сім'я `randomUUID()`), `rotateSession` (P2-3…P2-6), `endSession`, `endAllSessions`; підпис access-JWT переїхав сюди. `JWT_REFRESH_SECRET` більше не використовується — прибрати з `.env` і `CLAUDE.md` у Фазі 6
- [x] Opaque refresh: `randomBytes(32)` → base64url, у БД `sha256` hex; `userAgent` (≤ 512) / `ipAddress` (`req.ip`, ≤ 45) з кожного логіну й ротації. На проді за проксі потрібен `trust proxy`, інакше `ipAddress` = адреса проксі
- [x] Ротація: `$transaction` → `updateMany({ id, revokedAt: null })`, `count !== 1` → наступника не створюємо, запит іде гілкою «відкликаний токен» (P2-4)
- [x] Відкликаний токен: `< 30 с` + живий наступник у сім'ї → `409 REFRESH_SUPERSEDED` (cookies не чіпаємо); інакше — `revokeFamily` → 401. `Logger.warn` лише якщо в сім'ї справді було що відкликати (повторний refresh після logout / logout-all не шумить)
- [x] Усі 401 refresh-у — один код `INVALID_REFRESH_TOKEN` (не розкриваємо, що спрацювала reuse detection); `LOCKED` → `403 ACCOUNT_LOCKED`, `DELETED` → 401; 401/403 чистять cookies, 409 — ні
- [x] Роль у новому access-токені береться з БД під час refresh — зміна ролі діє максимум через 15 хв
- [x] Логін відкликає сесію з refresh-cookie цього ж браузера (повторні логіни не накопичують живі сесії)
- [x] `POST /auth/refresh`, `POST /auth/logout` (без guard, ідемпотентний), `POST /auth/logout-all` (guard, `{ revokedSessions }`), `GET /auth/me` → `{ user: UserAccount }` (`name`/`avatarUrl` з профілю; `bio` — коли з'явиться сторінка профілю, етап 10)
- [x] `auth/auth-cookies.ts`: `refresh_token` з `path=/api/v1/auth` і `expires` = кінець сесії; access — `path=/`, 15 хв; legacy `refresh_token` з `path=/` чиститься при login / refresh / logout (P2-7). Якщо браузер шле обидва — cookie з довшим `path` іде першим, `cookie-parser` бере перше входження. `JwtStrategy` і `OptionalJwtAuthGuard` читають access через `readAccessToken`. `API_GLOBAL_PREFIX` → `app.constants.ts` (`main.ts` і `path` cookie)
- [x] Перевірка (мінімальний Nest з `PrismaModule` + `AuthModule`, `curl` + `psql`): login → 3 `Set-Cookie` (access, refresh з `path`, очищення legacy); `me` → 200; ротація (старий revoked, новий у тій самій сім'ї, `expiresAt` +7 д); старий токен одразу → 409 без `Set-Cookie`; 5 паралельних refresh одним токеном → `200 409 409 409 409`, 1 жива сесія; старий токен через 60 с → 401, сім'я відкликана, легітимний наступник → 401, 1 warn; logout лише з refresh-cookie → відкликано, cookies очищено; logout без cookies → 200; logout-all (3 сесії) → `revokedSessions: 3`, інший пристрій → 401; LOCKED → refresh 403, сесія **не** відкликана, `me` → 401; DELETED → 401; прострочена → 401; сміття / legacy JWT → 401; `new; legacy` у Cookie → 200; USER→ADMIN у БД → після refresh `role: ADMIN` у токені. Тестового юзера видалено (сесії — каскадом)
- [x] `tsc`: 70 → **70** (auth 0, users 0 — 2b чужих модулів не лагодить)
- Свідомо не робимо: абсолютний ліміт життя сім'ї (ковзне вікно P2-6 — активний користувач живе в сесії безстроково); rate-limit на `/auth/login|refresh` — окремо, етап безпеки

#### 2c — Moderation ✅ (2026-09-26)
- [x] `security/`: `SecurityModule` (імпортує листові `UsersModule` + `AuthSessionsModule`; експортує `AbuseProtectionService`, `AccountModerationService`, `UserSanctionRepository` — останній для 2d), `UserSanctionRepository` (`hasActive`, `countStrikes`, `create`, `lockSanctionIssuing`), `RateLimitRepository` (`recordEvent`, `countSince`, `findLastEventAt`, `deleteOlderThan`)
- [x] `abuse.constants.ts`: `getRateLimitPolicy(action)` → `RateLimitPolicy` (вікно, поріг, тип/причина санкції, тривалість, код 403, `cooldown: { ms, code } | null`). LIKE: 5 за 5 с → 24 год, без cooldown; COMMENT: те саме + cooldown `COMMENT_COOLDOWN_MS` (60 с), обрізається до retention подій (24 год) — інакше cron ламав би довший cooldown
- [x] `AbuseProtectionService`: `assertActionAllowed` (активна санкція = `revokedAt null`, `startsAt ≤ now`, `endsAt null | > now` → 403; cooldown з останнього `RateLimitEvent` → 429) і `recordActionAndEnforceBurst` (подія → count у вікні → санкція). Видача санкції — `$transaction` + `pg_advisory_xact_lock(hashtext('<userId>:<action>'))` (P2-10; саме `xact` — сесійний лок не переживає transaction pooling Supabase); час для перевірки «вже є активна» береться **після** локу — інакше санкція паралельного запиту має `startsAt` пізніше і не видна. Exception кидається **після** commit (усередині `$transaction` відкотив би санкцію)
- [x] `LikeAntiAbuseService`, `CommentAntiAbuseService` → обгортки (публічні методи й `isAdmin`-обхід без змін); `lastCommentAt` з `comment.service.ts` прибрано — cooldown рахується з `RateLimitEvent`. Подія пишеться на спробу, що пройшла `assert` (відхилена cooldown-ом спроба cooldown не продовжує)
- [x] `AccountModerationService.lockAccount(input, db?)`: `UserRepository.markLocked` (`updateMany where status = ACTIVE` → ідемпотентно, з двох паралельних блокувань спрацьовує одне) + `UserSanction(ACCOUNT_LOCKED, endsAt null)` + `revokeAllForUser` — одна транзакція (своя або викликача); `false`, якщо акаунт уже не ACTIVE (дубля санкції немає). Лог — у викликача після commit. Ендпоінта ручного блокування ще немає (адмінка — окремо); чи заборонити блокувати ADMIN — вирішити разом з ним
- [x] `SecurityCleanupCron` (щогодини): `AuthSession.expiresAt < now − 7 д`, `RateLimitEvent.createdAt < now − 24 год`; кроки незалежні (збій одного не зупиняє інший). `SecurityModule` підключено і в `AppModule`
- [x] Перевірка — Nest application context (`PrismaModule` + `SecurityModule` + обгортки) на dev-БД, 31 перевірка ✅: послідовний burst → 5-та спроба 403 `LIKES_SUSPENDED`, санкція auto/24 год, події не видалено, коментарі не зачеплено; після закінчення санкції другий burst → 403 `ACCOUNT_LOCKED`, `LOCKED` + `lockedAt`, 1 × `ACCOUNT_LOCKED`, сесії відкликано, повторний `lockAccount` → `false`; **12 паралельних** спроб → рівно 1 санкція, акаунт ACTIVE; strike-2 одночасно по LIKE і COMMENT (різні локи) → рівно 1 блок; відкликана санкція — не strike і не блокує; санкція з `startsAt` у майбутньому не діє, безстрокова — діє; cooldown коментарів 429 → через 61 с OK, лайки без cooldown; адмін — ні санкцій, ні подій; cron видаляє лише старі записи. **Контрольний прогін без advisory lock** → паралельний burst дав 10 санкцій замість 1 (тест змістовний; `markLocked` навіть без локу дав 1 блок). Тестових юзерів видалено
- [x] `tsc`: 70 → **45** (security 0, users 0, auth 0, `*-anti-abuse.service.ts` 0; 2 помилки в `comment.service.ts` — `postId`/`matchId` → thread, Фаза 4)
- ⚠️ Для Фази 4: подія `COMMENT` пишеться **до** `createWithTx`, тож невдале створення (неіснуючий тред, `isLocked`, FK) все одно вмикає cooldown на 60 с (у v4 `lastCommentAt` ставився лише після успіху). Виправлення — у Фазі 4 перевіряти тред/ціль **до** anti-abuse, щоб після `record…` лишались лише збої БД
- Відоме обмеження (як і у v4): cooldown не атомарний — N паралельних коментарів проходять `assert` разом (до `burstThreshold − 1` = 4, далі спрацьовує burst). Якщо знадобиться — `assert` + `record` під тим самим advisory lock в одній транзакції
- Для 2d: `UserService` / `UserController` — **не** в `UsersModule` (він листовий, його імпортує `SecurityModule` → був би цикл), а в модулі, що імпортує `UsersModule` + `SecurityModule` + `AuthSessionsModule`

#### 2d — Видалення акаунта (розділ 7.5.1) ✅ (2026-09-26)
- [x] `users/management/`: `UserManagementModule` (імпортує `UsersModule` + `SecurityModule` + `AuthSessionsModule`; підключено в `AppModule`), `UserService`, `UserController`, DTO `DeleteOwnAccountDto { password }` (1…256), `DeleteUserDto { note? }` (trim, ≤ 500, тіло опційне)
- [x] `users/deleted-account.ts`: `deletedAccountEmail(id)` = `deleted-<id>@removed.invalid`, `DELETED_ACCOUNT_PASSWORD_HASH = ''` (`bcrypt.compare(x, '')` → `false` без винятку — перевірено), `DELETED_USER_DISPLAY_NAME`, `isReservedEmail` (P2-17, `AuthService.register`)
- [x] `UserService.deleteAccount` (private) — одна транзакція: `UserRepository.markDeleted` (email / `passwordHash` / `status = DELETED` / `deletedAt` + профіль `'Deleted user'`, avatar/bio → null) → (лише admin) `UserSanction(ACCOUNT_DELETED, MANUAL, issuedById, note, startsAt = deletedAt)` → `AuthSessionRepository.deleteAllForUser` (P2-16). Пости/коментарі/лайки/санкції не чіпаємо
- [x] Атомарність: коди помилок — з попереднього читання (`findCredentialsById` / `findAccessById`), а сам запис — `updateMany where { id, role: USER, status ≠ DELETED }`; `count = 0` → 409 (паралельне видалення встигло першим). Паралельне `lockAccount` чекає row lock і бачить DELETED → no-op
- [x] `DELETE /users/me` (guard): ADMIN → 403 `ADMIN_ACCOUNT_NOT_DELETABLE` (P2-14, до перевірки пароля); неправильний пароль → 403 `INVALID_PASSWORD` (P2-18, cookies не чіпаємо); успіх → 200 + `clearAuthCookies` (access, refresh, legacy). Self-delete у `UserSanction` не пишеться
- [x] `DELETE /users/:id` (ADMIN): 404 `USER_NOT_FOUND`, ADMIN-ціль → 403, уже DELETED → 409 `ACCOUNT_ALREADY_DELETED`; LOCKED видаляється; `{ message, userId }`. `Logger.log` лише з id (без email) — після commit
- [x] Живі access-JWT видаленого юзера → 401 одразу (`JwtStrategy` читає статус з БД); refresh → 401 `INVALID_REFRESH_TOKEN` (сесії не знайдено)
- [x] Перевірка — мінімальний Nest (`PrismaModule` + `AuthModule` + `UserManagementModule`) на dev-БД, скрипт `fetch` + Prisma, **56/56** ✅: реєстрація `…@removed.invalid` (і в іншому регістрі з пробілами) → 400; self: без cookies 401, без тіла / порожній пароль 400, неправильний 403 без `Set-Cookie` і сесія жива; успіх → анонімізовано, 0 сесій, 0 санкцій, другий пристрій (живий access) → 401, refresh → 401, старий і анонімний email → 401, повторна реєстрація тим самим email (у верхньому регістрі) → 201 з новим id і логіниться; admin: USER → 403, 404, себе / seed-адміна / `DELETE /me` адміном → 403, note > 500 → 400, санкція з обрізаною note і `issuedById`, повтор → 409 без дубля санкції, без тіла і з note із пробілів → `note = null`, LOCKED → DELETED; автор коментаря видаляється без FK-помилки, коментар на місці, `toPublicAuthor` → `{ name: 'Deleted user', avatarUrl: null, isDeleted: true }`; 6 паралельних admin DELETE → `200` + 5×`409`, 1 санкція; self + admin одночасно → рівно один 200. **Контрольний прогін без `status ≠ DELETED` у `markDeleted`** → self + admin дали обидва 200 (тест змістовний); 6 паралельних admin DELETE без запобіжника все одно пройшли — запити фактично серіалізувались, тож цей тест сам по собі слабкий. Тестових юзерів і тред видалено
- [x] `tsc`: 45 → **45** (users 0, auth 0, security 0); `eslint` по змінених файлах чистий
- [x] **Захист адрес анонімізації на рівні БД:** CHECK `User_reserved_email_check` (`prisma/sql/constraints.sql` + міграція `0002_user_reserved_email_check`, застосовано на dev): не-DELETED → `lower(email) NOT LIKE '%.invalid'`; DELETED → `email = 'deleted-' || id || '@removed.invalid'`. Закриває будь-який шлях створення (seed, майбутні адмін-створення / OAuth), не лише `register`, і гарантує «DELETED ⇒ email анонімізовано». Перевірено в транзакціях з `ROLLBACK`, 10/10: squatting `deleted-<id>@…`, `.INVALID` у верхньому регістрі, LOCKED з `.invalid`, DELETED з чужим id, `status → DELETED` без анонімізації, DELETED → ACTIVE з анонімною адресою — падають; звичайні адреси, `invalid@invalid.com` і коректна анонімізація — проходять. Повний сценарій 2d з обмеженням — знову 56/56
- [x] `AuthService.login`: `credentials?.passwordHash || dummy` (було `??`) — порожній хеш видаленого акаунта теж іде через фіктивний bcrypt, час відповіді не відрізняється (P2-2)
- [x] `apps/api/.prettierrc`: `"endOfLine": "crlf"` — як у `eslint.config.mjs`; раніше `prettier --write` переписував файли в LF, а ESLint вимагав CRLF
- [x] `cookies.txt` (curl cookie jar з v4-JWT адміна) прибрано з індексу git; `cookies.txt` / `*.cookies` → `.gitignore`
- [x] **Блок пошт видалених акаунтів** (P2-19, P2-20): `security/email-blocklist/` — `BlockedEmail` (міграція `0003_blocked_email`, застосовано на dev), `EmailBlocklistService` (`isBlocked`, `blockDeletedAccountEmail`), `canonicalizeEmail`. Запис — у транзакції видалення: справжня адреса читається **до** анонімізації (`UserRepository.findEmailById`), блок пишеться лише якщо `markDeleted` спрацював. Слабший блок не перезаписує сильніший (безстроковий > довший > коротший) — під `pg_advisory_xact_lock(hashtext(emailHash))`, бо два різні акаунти можуть мати одну канонічну адресу. `EMAIL_HASH_SECRET` (≥ 32) — без нього API не стартує; прострочені блоки чистить `SecurityCleanupCron`
- [x] **Ліміти спроб** (P2-21): `security/throttling/` — `RequestThrottlingModule` (`ThrottlerModule.forRoot`, ліміти `ip` і `account`; `account` = id користувача або нормалізований email з тіла). Політики: login — 10/хв з IP + 10/15 хв на адресу; register — 5/10 хв з IP; refresh — 30/хв з IP; `DELETE /users/me` — 5/15 хв на користувача (`JwtAuthGuard` перед `ThrottlerGuard`). 429 `TOO_MANY_REQUESTS` + `Retry-After-ip|account` (додано в CORS `exposedHeaders`). `/auth/me`, logout — без лімітів
- [x] **Helmet + no-store + trust proxy**: `app.setup.ts` (`configureHttpApp` — спільний для `main.ts` і тестового застосунку): `helmet` з CORP `same-site`, `TRUST_PROXY` з env (`true` заборонено — інакше IP підробляється через `X-Forwarded-For`); `Cache-Control: no-store` на `register`, `login`, `refresh`, `me`
- [x] Перевірка (тестовий Nest з `configureHttpApp` + `RequestThrottlingModule`, dev-БД): ядро 2d **57/57** (повторна реєстрація → 403 `EMAIL_BLOCKED`, `BlockedEmail` = self / +30 д, у БД лише 64-hex хеш); безпека **37/37** — блоклист: admin → безстроково; той самий email у верхньому регістрі / з пробілами / з `+tag` → 403, інша адреса того ж домену → 201; gmail з крапками / `+tag` / `googlemail.com` → 403; admin-блок не послаблюється наступним self-delete; self → admin підвищує до безстрокового; після закінчення 30 днів реєстрація → 201; гонка self + admin → рівно один 200 і рівно 1 блок з причиною переможця. Ліміти: 11-та спроба логіну з IP → 429 + `Retry-After-ip`, інший IP не зачеплено; 10 невдалих спроб на акаунт з 10 різних IP і в різному регістрі → 11-та навіть з правильним паролем → 429, інший акаунт логіниться; register (навіть невалідні тіла — guard працює до `ValidationPipe`) 6-та → 429; refresh 31-ша → 429; 70 × `/auth/me` → усі 200; `DELETE /users/me`: 5 неправильних паролів з різних IP → 6-та (правильний пароль) → 429, акаунт не видалено. Заголовки: без `X-Powered-By`, є `nosniff`, HSTS, CSP, CORP `same-site`, `X-Frame-Options`; `no-store` на login / me; CORS preflight з localhost:3000 — дозволено, з чужого origin — ні. Негативні запуски: без `TRUST_PROXY` підроблений `X-Forwarded-For` не обходить ліміт (11-та → 429); `TRUST_PROXY=true` і порожній / короткий `EMAIL_HASH_SECRET` → застосунок не стартує. Тестові дані прибрано
- [x] `tsc`: 45 → **45** (users, auth, security — 0); `eslint` по змінених файлах чистий
- ⚠️ **Відкрите (security review 2d):**
  - `cookies.txt` — у публічній історії git (прибрано з індексу, `.gitignore`). Рішення: не чистимо (тестовий адмін). На прод — **новий випадковий `JWT_SECRET`** (`openssl rand -base64 48`), не dev-фраза
  - `JWT_REFRESH_SECRET` не використовується з 2b — прибрати з `.env` і `CLAUDE.md` (Фаза 6)
  - Ліміти в пам'яті процесу: на проді з кількома інстансами — Redis-сховище для throttler; за reverse proxy — задати `TRUST_PROXY`
  - `register` → `409 Email already in use` (і `403 EMAIL_BLOCKED`) розкривають, чи відома адреса (enumeration). Повністю закривається лише підтвердженням email (відповідь «перевірте пошту» в усіх випадках) — перед продом
  - Admin-розблокування пошти (ввести адресу → видалити її `BlockedEmail`) — коли з'явиться адмінка користувачів
  - Для 2e: 429 (`TOO_MANY_REQUESTS`) від `/auth/refresh` — **не** розлогінювати (повторити пізніше за `Retry-After-ip`); 403 `EMAIL_BLOCKED` / `INVALID_PASSWORD` — помилки форми
  - Перевірено й **без проблем**: `email` / `passwordHash` не потрапляють у жодну публічну відповідь (v4-селекти авторів — лише `id, name, avatar`; `PUBLIC_AUTHOR_SELECT` — без email; лайки віддають лише лічильники й власну реакцію); логи 2d — лише id; помилки Prisma → 500 без деталей; `DELETE` з JSON — preflight, CORS пускає лише localhost:3000/3001, cookies `sameSite=lax` (CSRF закритий)
- Свідомо не робимо: LOCKED-юзер не може видалити себе сам (`JwtStrategy` → 401) — лише через адміна; `RateLimitEvent` не видаляємо (лише `userId` + дія, cron прибирає за 24 год). Для 2e: 403 `INVALID_PASSWORD` показати як помилку форми, а не розлогінювати

#### 2e — Frontend ✅ (2026-09-26)
- [x] `packages/types`: `PublicAuthor { id, name, avatarUrl, isDeleted }`, `UserRole`, `User` (`avatarUrl: string | null` замість `avatar?`), `Post.author` / `Comment.author` → `PublicAuthor`. Admin: `AdminPostRow.author` → `PublicAuthor`, `AdminUser = User`
- [x] web + admin `lib/api/http.ts` (одна логіка в обох — міняти разом; admin без `NextFetchInit`):
  - `ApiError { status, code, retryAfterSeconds }`, `code` = `message` з тіла Nest (масив ValidationPipe → `join('; ')`), тож старі перевірки `err.message === 'ACCOUNT_LOCKED'` працюють; `retryAfterSeconds` — максимум з `Retry-After-ip|account`; `isApiError`
  - Refresh-on-401 лише в браузері (`typeof window`), не для `/auth/login|register|refresh|logout`; single-flight; **один** повтор запиту (повторний 401 — викликачу)
  - Результат refresh: 200 / **409** (P2-5) → повтор; **лише 401 / 403** → `onSessionExpired(listener)` + помилка (403 несе `ACCOUNT_LOCKED` → її й кидаємо, інакше — оригінальний 401); 429 / мережа / 5xx → не розлогінюємо, кидаємо помилку refresh; після 429 refresh не викликається до `Retry-After` (дефолт 60 с)
  - `sessionGeneration` (росте з кожним успішним refresh **і логіном**): 401 на запит, відправлений до них, одразу повторюється без другого refresh; 401 / 403 від refresh, що завершився **після** логіну, — про стару сесію: без `session-expired`, запит повторюється з новими cookies
  - `apiDelete(url, body?)` (P2-15); у `apiGet` виправлено: `...rest` після злитих `headers` перезаписував їх
- [x] web: `useAuthQuery` / `authMeQueryOptions` (`['auth','me']`, 401 / 403 → `null`, решта помилок — `throw` з ретраєм за `Retry-After`, `staleTime` 5 хв); `providers/AuthSessionSync.tsx` (у `QueryProviders`) — єдиний запис у `useAuthStore` (`syncSession`), на `onSessionExpired` → `markSignedOut` (лише якщо `me` не був `null` — гість після F5 теж отримує 401 від refresh). Login → `writeCurrentUser(me, user)`; logout (`onSettled`, і при помилці) → `markSignedOut`: `me = null` + інвалідація `likes`. Перед записом у `me` — `cancelQueries(me)`: інакше відповідь `me`, відправленого до login / logout, перезаписує свіже значення (перевірено на `@tanstack/query-core` 5.96: без cancel — перезапис в обох випадках) (замість `queryClient.clear()`, який ламав активних observer-ів). `NavbarClient` — заглушка, поки `me` не відповів (без блимання «Sign in» у залогіненого)
- [x] Форми: login — `ACCOUNT_LOCKED`, `TOO_MANY_REQUESTS`, 401 → «Invalid email or password», не-`ApiError` → загальна помилка; register — `EMAIL_BLOCKED`, `TOO_MANY_REQUESTS`, 409 → «already registered» (en + ua). Admin-логін — те саме англійською; admin `useAdminSessionExpiry` (в `AdminShellBar`): refresh відхилено → `qc.clear()` + `/login`
- [x] «Видалений користувач» за `author.isDeleted` — `hooks/useAuthorDisplayName` (`users.deletedUser`) у `HomeFeed`, `NewsPostView`, `CommentThreadNode` (сіра аватарка «?», курсив; `name[0]` більше не падає на порожньому імені), admin `adminAuthorName`. Наживо — після Фаз 3–4 (поки API posts/comments на v4, `isDeleted` = `undefined` → показується ім'я)
- [x] **API — `POST /auth/refresh` чистить cookies лише якщо запит мав refresh-cookie** (знайдено на рев'ю): запізніла відповідь 401 на refresh гостя (на сторінці логіну) інакше стирала cookies логіну, зробленого паралельно, — користувач розлогінений одразу після входу. Гостю чистити нічого
- [x] **API (знайдено при перевірці):** анонімний відвідувач на кожному F5 робить `me 401 → refresh 401`, і ці refresh без cookie їли ліміт 30/хв на IP — за NAT анонімні відвідувачі давали б 429 залогіненим сусідам. `auth/guards/refresh-throttler.guard.ts` (`RefreshThrottlerGuard extends ThrottlerGuard`, `shouldSkip` без refresh-cookie) на `POST /auth/refresh`; запит без cookie — миттєвий 401 без БД
- [x] Перевірка — мінімальний Nest (`PrismaModule` + `RequestThrottlingModule` + `AuthModule` + `UserManagementModule`, `configureHttpApp`) на dev-БД:
  - harness імпортує **справжній** `http.ts` (Node 24 type stripping), `fetch` → cookie jar як у браузері (path, видалення, спільний jar для «вкладок»): **web 33/33, admin 33/33** — гість (401, 1 refresh, 35 refresh без cookie → жодного 429); login / помилки логіну без refresh, `user.avatarUrl`; зниклий access → 1 refresh + повтор; 6 паралельних → 1 refresh; недійсний JWT → refresh; дві вкладки одночасно × 5 → обидві 200, 409 траплявся, `session-expired` немає, 1 сім'я / 1 жива сесія; `DELETE /users/me` з тілом: 403 `INVALID_PASSWORD` без refresh, сесія жива; logout-all з іншого пристрою → 401, 1 подія, cookies прибрано; LOCKED → 403 `ACCOUNT_LOCKED` + подія; self-delete → cookies прибрано, реєстрація → 403 `EMAIL_BLOCKED`; refresh 429 → помилка 429 з `retryAfterSeconds`, без події, повторно refresh не викликається; **T12 гонка** (детерміновано: відповідь refresh гостя «затримана в мережі», поки йде логін) → cookies логіну цілі, `session-expired` немає, запит, відправлений до логіну, отримав користувача
  - **Контрольні прогони:** `http.ts` без обробки 409 → T6 падає 5/5 (одна вкладка `REFRESH_SUPERSEDED`); API зі звичайним `ThrottlerGuard` → 31-й анонімний refresh → 429 (з фіксом — 35 × 401; з cookie ліміт діє: 31-й → 429); T12 до фіксу — 4 ❌ (cookies стерто, хибний вихід); лише з API-фіксом (без generation-перевірки) — cookies цілі, але хибний `session-expired` + 401 на запит
  - **Браузер** (headless Chrome через CDP + `next dev`), **16/16**: гість → «Sign in»; логін формою → ім'я в Navbar, редірект; F5 → ім'я, лише `me 200`; видалено access-cookie (= минуло 15 хв), лишився `refresh_token@/api/v1/auth` → F5 → ім'я, ланцюжок `me 401 → refresh 200 → me 200`, +1 сесія в тій самій сім'ї; logout → «Sign in», cookies прибрано, після F5 — гість, сесія в БД відкликана; невірний пароль у формі → «Invalid email or password.» / «Неправильний email або пароль.» (`instanceof ApiError` працює в клієнтському бандлі)
  - Тестових юзерів, сесії, `BlockedEmail` прибрано (у БД лише seed-адмін)
- [x] Рев'ю після реалізації: відповідність пунктам 2e і приміткам 2d (429 від refresh не розлогінює, `EMAIL_BLOCKED` / `INVALID_PASSWORD` — помилки форми) ✅; знайдено й виправлено 3 гонки (вище). Поза 2e, лишено як є: `LikeBar.tsx` — старий ESLint error `react-hooks/set-state-in-effect`; admin-логін звичайного USER показує «Access denied», але сесія (cookies) лишається; `CommentSection` / `LikeBar` поки `isLoading` бачать гостя (CTA «увійдіть» на мить після F5)
- [x] `pnpm build` web + admin ✅; `tsc` API: 45 → **45** (auth, users, security — 0); `eslint` по змінених файлах чистий (web — лише старі попередження `<img>`)
- Свідомо не робимо: спільний пакет для `http.ts` web/admin (поки дві копії з приміткою «міняти разом»; кандидат у `packages/`, коли з'явиться третій клієнт або CSRF-заголовок); SSR-стан auth (RSC не бачить cookies браузера → Navbar відновлюється на клієнті із заглушкою); cross-tab лок refresh (Web Locks) — гонку вкладок закриває 409 від API
- Відоме обмеження: при 409 повтор може піти раніше, ніж браузер застосує `Set-Cookie` відповіді іншої вкладки (обидві відповіді приходять майже одночасно; у прогонах не траплялось) — тоді запит отримає 401 як є (без `session-expired`; для `/auth/me` Navbar покаже гостя), а наступний запит / фокус вікна відновить стан

#### Рев'ю Фаз 1–2 (2026-09-26)
Звірено код з розділами 5, 5.1, 7, 7.5.1 і P2-1…P2-21: схема = розділ 5 + `BlockedEmail` (2d); `tsc` API — 45 (auth, users, security — 0). Критичних проблем (обхід auth, витік email/хешів, ескалація ролі, CSRF) не знайдено.
- [x] `RegisterDto.name`: trim **до** `MinLength` — ім'я з пробілів проходило валідацію і ставало порожнім `displayName`
- [x] `JWT_SECRET`: `readJwtSecret()` (`auth.constants.ts`) — < 32 символів → API не стартує (як `EMAIL_HASH_SECRET`); алгоритм закріплено: підпис і `JwtStrategy` — лише `HS256`
- [x] Перевірка (мінімальний Nest, dev-БД) 9/9: короткий секрет → старт падає; ім'я `"   "` → 400, `"  Ab  "` → `Ab`; login / me / refresh → 200; токен HS512 тим самим секретом і `alg=none` → 401. Тестового юзера прибрано
- [x] Документація: `BlockedEmail` у розділах 4, 5, 5.1; `CLAUDE.md` — `JWT_SECRET`, admin не викликає `/auth/me`
- ⚠️ **До проду (не код-баг, а політика)** → бэклог Redis-етапу в `football-plan-new.md`: strikes анти-абузу рахуються за весь час, а ендпоінта розблокування немає → легітимний користувач, що двічі (з будь-яким інтервалом) лайкне 5 разів за 5 с, блокується назавжди. Варіанти: strikes лише за N днів, м'якший поріг для LIKE, `POST /users/:id/unlock` (ADMIN) — разом з адмінкою користувачів
- [x] ~~До проду: CORS з env, абсолютний ліміт сесії, пароль ≥ 8~~ → зроблено у **2f**
- [x] ~~Фази 3–4: валідація коментаря й URL постів~~ → зроблено у **2f**
- [x] ~~Опційно: `sid` в access-JWT, `apiGet` без `Content-Type`, адмін-логін без сесії для USER~~ → зроблено у **2f**

#### 2f — Hardening після рев'ю ✅ (2026-09-26)

| # | Рішення | Чому |
|---|---|---|
| P2-22 | `CORS_ORIGINS` (через кому) обов'язковий; кожне значення — рівно origin (`new URL(x).origin === x`: без шляху, `/`, `*`); на проді лише https; збіг — точний, через `Set` | Захардкоджений localhost не працює на проді; `*` з `credentials` заборонений; помилка конфігу видна на старті, а не як «CORS error» у браузері |
| P2-23 | Абсолютний ліміт сесії **30 днів** від логіну: `AuthSession.familyStartedAt`, `expiresAt = min(ротація + 7 д, familyStartedAt + 30 д)`, refresh додатково перевіряє сам дедлайн. Не через `iat`: refresh-токен opaque (не JWT, `iat` немає), а старт сім'ї в БД клієнт не підробить. Access обмежений тим самим через `sid` (P2-26) | Вкрадена сесія не живе вічно, навіть якщо зловмисник рефрешить щодня |
| P2-24 | Пароль ≥ **8** лише для **нового** пароля (реєстрація); логін / `DELETE /users/me` — без мінімуму | Акаунти, створені з 6–7 символами, мають і далі входити |
| P2-25 | `packages/validation`: `.` — числа (без залежностей, їх імпортує API в class-validator DTO), `./forms` — zod-схеми для web / admin (zod — optional peer). Збирається `tsc` у CJS (`dist`); turbo `dev` / `build` збирає його першим, `pnpm install` — через `prepare`. API лишається на class-validator (правило 5), спільні — самі межі | Правила не розходяться; zod не тягнеться в API |
| P2-26 | Access-JWT `{ sub, role, sid }`, `sid` = `AuthSession.familyId`. Назва — `sid` (OIDC), не `jti`: `jti` — id одного токена, а тут усі access-токени сесії (після кожної ротації) мають спільне значення. `JwtStrategy` одним запитом: жива сесія сім'ї (`revokedAt IS NULL`, `expiresAt > now`) + статус і роль власника (індекс `[familyId, revokedAt]`). Токен без `sid` → 401 → refresh | Logout / logout-all / reuse / блокування / видалення гасять access **одразу**; сховище — наша `AuthSession` (без нової таблиці, Redis — бэклог) |
| P2-27 | `TRUST_PROXY` на проді **обов'язковий** (`1` / адреси проксі, або `0` / `false` — проксі немає); у dev порожньо | Без проксі довіра до `X-Forwarded-For` дає підробити IP; на проді «забули» = усі ліміти на IP спільні для всіх |
| P2-28 | Ліміти: на IP — лише анонімні `login`, `register` і `refresh` (до перевірки refresh-cookie особа невідома; без cookie — не рахується, 2e); залогінені — за `userId` (`DELETE /users/me` — `account`, лайки / коментарі — `RateLimitEvent.userId`) | Перевірено аудитом — змін у коді не знадобилось |
| P2-29 | `POST /auth/login/admin`: роль перевіряється **після** пароля і **до** `endSession` / `startSession` → не-ADMIN: 403 `ADMIN_ONLY`, без cookies і без нової сесії, сесія на сайті ціла. Лічильник throttler-а спільний з `login` (`generateKey` без імені handler-а) | Не видавати токени, щоб потім розлогінювати; два роути не подвоюють ліміт перебору |

- [x] CORS (P2-22) — `app.setup.ts` `parseCorsOrigins`; `CORS_ORIGINS` у `apps/api/.env`
- [x] Абсолютний ліміт (P2-23): міграція `0004_auth_session_absolute_lifetime` (колонка з backfill `MIN(createdAt)` сім'ї, живі сесії обрізано до +30 д, індекс `[familyId, revokedAt]`), застосовано на dev, `migrate diff` БД → схема порожній
- [x] Пароль (P2-24, P2-25): `packages/validation`; DTO (`register`, `login`, `delete-own-account`, коментар) на спільних межах; web `LoginForm` / `RegisterForm` / `CommentSection` / `CommentThreadNode`, admin `AdminLoginForm` / `CreatePostForm` — на спільних схемах
- [x] `TRUST_PROXY` (P2-27, P2-28)
- [x] `sid` (P2-26): `auth-session.service.ts`, `jwt.strategy.ts`, `AuthSessionRepository.findLiveSessionOwner`
- [x] `apiGet` без `Content-Type` (web + admin) — GET більше не робить CORS preflight
- [x] Адмін-логін (P2-29): `auth.controller.ts`, `AuthService.login(…, { requiredRole })`, admin `useAdminLogin` → `/auth/login/admin`, `ADMIN_ONLY` у формі; `/auth/login/admin` у `ENDPOINTS_WITHOUT_REFRESH` / `SESSION_START_ENDPOINTS` обох `http.ts`
- [x] Валідація (Фази 3–4 наперед): `CreateCommentDto.content` — `TrimString()` + 2…2000; `coverImage` / `videoUrl` — `@IsMediaUrl()` (лише https, ≤ 2048), `sourceUrl` — `@IsSourceUrl()` (http/https — без `javascript:`). `common/validation/`: `TrimString()` замість 5 копій `@Transform(trim)`
- [x] SSRF: API ці URL **не фетчить** (лише `<img src>` на web, `videoUrl` ніде не рендериться) — захист не потрібен зараз; вимога записана в `url-field.decorators.ts`: при серверному fetch (OG-превʼю, ресайз, `next/image`) — блок приватних / локальних IP після резолву + без редиректів
- [x] Перевірка — тестовий Nest (`PrismaModule` + `RequestThrottlingModule` + `AuthModule`, `configureHttpApp`) на dev-БД, **48/48**: `CORS_ORIGINS` — відсутній / `/` у кінці / шлях / `*` / ftp → старт падає, прод + http → падає, валідний список з пробілами — ок; прод без `TRUST_PROXY` → падає, `0` / `false` — ок, `true` — падає; preflight з localhost:3000 → ACAO + credentials, з чужого origin і `localhost:30000` → без ACAO; DTO: коментар `"   "` / 2001 → невалідний, `"  ok  "` → `ok`, 2000 — ок; cover http / `javascript:` / `data:` / без протоколу → невалідні, https — ок, source http — ок; пароль 7 → 400, 8 → 201; USER на `/auth/login/admin` → 403 `ADMIN_ONLY`, 0 `Set-Cookie`, сесій не додалось, сесія на сайті жива; неправильний пароль там → 401 (роль не розкрито); ADMIN → 200 + cookies; після ротації старий і новий access → 200; logout → обидва 401 одразу; logout-all → access іншого пристрою 401 одразу; токен з правильним підписом без `sid` → 401; логін: `expiresAt` ≈ +7 д; день 29 → refresh 200, наступник і `Expires` cookie ≈ +1 д; день 31 при `expiresAt` у майбутньому → 401; прострочена сесія → її access 401; 6 × `login` + 5 × `login/admin` на одну адресу → 11-та 429. Тестових юзерів прибрано
- [x] `pnpm build` web + admin ✅; `tsc` API: 45 → **45** (auth, users, security, common, DTO — 0); `eslint` API і web по змінених файлах чистий
- ⚠️ Після деплою 2f усі видані access-токени (без `sid`) → 401 → фронт один раз робить refresh — користувачі не розлогінюються
- ⚠️ `JwtStrategy` тепер читає `AuthSession` (замість `User`) — так само 1 запит на захищений запит; кеш / Redis — бэклог

### Фаза 3 — Content

#### 3.0 Контекст (аналіз коду, 2026-09-26)

`tsc` = **45**, з них posts — 11 (`published`, `coverImage`, `language`, `author.name`, `comments` у select деталі). Тегів / клубів у БД 0, турнірів 9, постів 3 (усі `PUBLISHED`, en + ua; довжини влазять у межі P3-9). Модуля тегів немає — теги лише в складі поста.

Знайдено при аналізі:
- **Розділ 8 суперечить сам собі:** фільтр `status = PUBLISHED AND publishedAt <= now()` без cron-а означає, що `SCHEDULED` не з'явиться ніколи → P3-1
- `GET /posts/:slug` фільтрує лише `deletedAt` → **DRAFT відкривається за slug**; лайк чернетки теж проходить (`LikeRepository.assertPostExists`)
- `PUT /posts/:id` — «author or ADMIN»: з `status` в update розжалуваний автор міг би публікувати → P3-7
- `?page=abc` → `NaN` у `skip` → 500; у DTO постів немає меж довжин; неіснуючий `tagId` → FK → 500
- `ValidationPipe` — `whitelist` без `forbidNonWhitelisted`: стара адмінка з `published: true` мовчки створила б DRAFT → API і адмінка міняються **в одному коміті**
- web читає коментарі через `GET /comments/post/:id`, а не з деталі поста — `comments` з деталі можна прибрати без змін UI

#### 3.1 Рішення (доповнюють розділ 8)

| # | Рішення | Чому |
|---|---|---|
| P3-1 | **Живий пост** = `deletedAt IS NULL AND status IN (PUBLISHED, SCHEDULED) AND publishedAt <= now() AND ∃ переклад default-мови`. Один предикат (`livePostWhere`) для стрічки, деталі за slug і `LikeRepository.assertPostExists`. Cron-а немає: `SCHEDULED` стає видимим сам, статус у БД лишається `SCHEDULED` (адмінка показує «Published» за датою) | Розділ 8 дозволяє «лише фільтр», але буквальний `status = PUBLISHED` ховав би заплановані назавжди. Чернетка не відкривається за slug і не лайкається |
| P3-2 | Переходи статусу — чиста функція `resolvePostPublication` (unit-тести): **DRAFT** → `publishedAt = null`, дата в запиті → 400; **PUBLISHED** → дата з запиту (лише ≤ now, минула — дозволено) / наявна / `now()`; **SCHEDULED** → дата з запиту або наявна, обов'язково > now; **ARCHIVED** → дата не змінюється, при створенні заборонено. Оновлення без `status` валідує дату проти поточного статусу | Інваріант CHECK `Post_published_has_date_check` тримає сервіс, а не 500 з БД; перенос запланованого без зміни статусу працює |
| P3-3 | `LanguageService` (`src/languages/`): мови з БД, кеш у пам'яті 60 с. Читання: `lang` невідомий / неактивний / не рядок → default, без 400. Запис: `languageCode` перекладу — лише активна мова (400 `UNSUPPORTED_LANGUAGE`), дублікати — 400. Перевірка в сервісі, не в DTO (потрібна БД) | Нова мова = `INSERT` без редеплою (D8); кеш — щоб не читати `Language` на кожен запит |
| P3-4 | Контракт відповіді: переклад **розгорнуто** в пост (`title`, `excerpt`, деталь — `content`) + `resolvedLanguage`; масиву `translations` у публічних відповідях немає — fallback живе лише в API (`getTranslation` на web прибрано). `coverImage` → `coverImageUrl`; дата в UI — `publishedAt` (за нею ж сортування). Деталь: + `videoUrl`, `sourceUrl`, `availableLanguages` (для `hreflang`), `competitions`, `clubs`; `comments` прибрано | Одне місце для fallback; web не знає, яка мова default |
| P3-5 | Інваріант «кожен пост має переклад default-мови»: обов'язковий при створенні, видалити переклад через API не можна. Публічні запити додатково фільтрують `translations some default` | Якщо інваріант колись порушиться (зміна default-мови без backfill), пост зникне зі стрічки, а не зламає fallback / пагінацію |
| P3-6 | Slug: з заголовка default-мови, NFKD → ASCII, ≤ 80 символів, порожній → `post`; колізія (`P2002`) → суфікс `-<6 hex>` (3 випадкові байти), до 5 спроб. Генерується **один раз** при створенні (суворіше за «не змінюється після публікації»; редагування slug чернетки — адмінка, етап 11) | Замість `…-1775485815788`; унікальність тримає `@unique` без гонки |
| P3-7 | `PUT /posts/:id` → **лише ADMIN** (було: автор або ADMIN). `DELETE` — атомарний `updateMany where deletedAt null`, повтор → 404, відповідь `{ id }` (не весь рядок) | Створення вже лише з адмінки; з `status` в update колишній адмін-автор міг би публікувати |
| P3-8 | `tagIds` / `clubIds` / `competitionIds`: унікальні, ≤ 20, існування перевіряється → 400 `UNKNOWN_TAG` / `UNKNOWN_CLUB` / `UNKNOWN_COMPETITION`; в update переданий масив **замінює** зв'язки, відсутній — не чіпає | Замість 500 на FK; семантика як у v4 для тегів |
| P3-9 | Межі в `packages/validation` (trim): title 5–200, excerpt 10–500, content 20–100 000; query `page` 1–100 000, `limit` 1–50; JSON-тіло API — 1 MB (`JSON_BODY_LIMIT`) | Ті самі числа в DTO і формі адмінки (P2-25); `NaN` / `1e20` → 400 замість 500; UA-переклад на 100 000 символів кирилицею ≈ 200 KB — у дефолтні 100 KB Express не влазив |
| P3-10 | Адмінка: «View on site» лише для живих постів; бейдж статусу з урахуванням дати | Посилання на чернетку дало б 404 |

Свідомо не робимо: `hreflang` / `canonical` на web — немає `metadataBase` (абсолютного URL сайту), API вже віддає `availableLanguages` → етап SEO; редагування / зміна статусу існуючого поста в адмінці — етап 11 (API `PUT` готовий); пагінація `GET /posts/admin/all` — етап 11.

#### 3a — Реалізація ✅ (2026-09-26)
- [x] `src/languages/`: `LanguagesModule`, `LanguageRepository`, `LanguageService` (P3-3; кеш 60 с, паралельні запити після TTL — одне читання БД, збій не кешується; default-мова читається завжди, навіть якщо `isActive = false`)
- [x] `PostRepository`: `findPublicPage` / `findPublicBySlug` через `livePostWhere` + «є переклад default-мови» (P3-1, P3-5), сортування `publishedAt desc, id desc` (стабільна пагінація); переклади й назви тегів — лише мов `[запитана, default]`; `findPublicTranslationLanguages` (паралельно з деталлю, без контенту); `findAllForAdmin` (усі мови); `create` / `update` — одна nested-операція (поля + переклади + зв'язки атомарно), `update` з `where { id, deletedAt: null }`; `softDelete` — `updateMany`, `countExistingRelations`
- [x] `post-response.ts`: `toPublicPostSummary` / `toPublicPostDetail` / `toAdminPostView` (P3-4); автор — `toPublicAuthor` (P2-13); тег: запитана → default → `slug` (D17)
- [x] DTO: `PostFieldsDto` (спільна база create / update): `status` (`IsEnum`), `publishedAt` (ISO **з зоною** — `Z` / `±hh:mm`), URL-и (`null` — очистити), `tagIds` / `clubIds` / `competitionIds` (унікальні, ≤ 20); `PostTranslationDto { languageCode, title, excerpt, content }` (trim + межі P3-9); `ListPostsQueryDto` (`page`, `limit` ≤ 50, `lang` без валідації — `@Allow`). Невикористаний `UpdatePostTranslationDto` прибрано
- [x] Сервіс: `DEFAULT_TRANSLATION_REQUIRED`, `UNSUPPORTED_LANGUAGE`, `DUPLICATE_TRANSLATION_LANGUAGE`, `UNKNOWN_TAG|CLUB|COMPETITION`, коди `resolvePostPublication` (P3-2); slug — P3-6 (`post-slug.ts`, транслітерація `ø/ł/ß/æ…`, яких NFKD не розкладає); `PUT` / `DELETE` — P3-7; `404 POST_NOT_FOUND`
- [x] `LikeRepository.assertPostExists` → `livePostWhere` (P3-1)
- [x] `packages/validation`: межі постів (P3-9), zod `postTitleSchema` / `postExcerptSchema` / `postContentSchema`
- [x] `packages/types`: `Post` (розгорнутий переклад, `resolvedLanguage`, `publishedAt`, `coverImageUrl`, `tags: PostTag[]`), `PostDetail` (без `comments`), `PostStatus`; `getTranslation` / `PostTranslation` прибрано — **частина Фази 6 зроблена тут**, бо контракт змінився
- [x] Admin: `CreatePostForm` — Draft / Publish now / Schedule + `datetime-local` (локальний час → ISO з `Z`, `min` = зараз, zod: дата в майбутньому), межі зі спільних схем, UA — або всі поля, або жодного; коди помилок API → текст. Список: бейдж Draft / Scheduled / Published / Archived з урахуванням `isLive`, рядок дати («Goes live …» / «Published …» / «Created …»), мови перекладів, «View on site» лише для живих (P3-10); `useAdminPosts` без `lang`
- [x] Web: `HomeFeed` — бейдж мови (`EN`, `title` + `sr-only` «Переклад недоступний — показано мовою: англійська»), `lang` на заголовку / анонсі; `NewsPostView` — банер `role="note"`, `<article lang>`; дата — `publishedAt`; назва мови — `Intl.DisplayNames` (`contentLanguageName`), `ua` → `uk` для атрибута `lang` (`contentLangToBcp47`)
- [x] **Web (знайдено при перевірці, баг з коміту локалізації):** `news/[slug]/page.tsx` — `prefetchQuery` ковтає помилки, тож `notFound()` був мертвим кодом: відсутній пост / чернетка → HTTP **200** з «Завантаження статті…». Тепер `fetchQuery` + `notFound()` лише на 404 від API; збій мережі / 5xx — рендер без кешу, клієнт робить refetch (перевірено: API вимкнено → 200, не 404)
- [x] Перевірка:
  - unit (jest) **53** нових: `resolvePostPublication` (усі переходи P3-2), `slugifyTitle` / суфікс, `LanguageService` (fallback, нормалізація, кеш / TTL, конкурентне завантаження, збій)
  - інтеграція — мінімальний Nest (`PrismaModule` + `RequestThrottlingModule` + `AuthModule` + `PostModule`, `configureHttpApp`) на dev-БД, справжні HTTP-запити з cookies, **95/95**: форма відповіді (без `translations` / `status` / `deletedAt` / email); `lang` = `ua` / `UA` / `xx` / `de` / масив / порожній; `page` / `limit` невалідні → 400, пагінація без перетинів; USER → 403 на POST / PUT / DELETE / admin; чернетка: slug `mbappe-scores-twice-…`, trim, 404 за slug, не в стрічці, не лайкається; колізія slug → суфікс; EN-only + `?lang=ua` → `resolvedLanguage: en`, `availableLanguages: [en]`, після `PUT` UA → `[en, ua]`, slug не змінився; теги ua / en-fallback / slug; турнір PL у деталі; `coverImageUrl: null` очищає, `tagIds` замінює, `[]` очищає; SCHEDULED +4 с: до дати 404 / не лайкається → після — у стрічці й деталі **без cron**, в адмінці `SCHEDULED` + `isLive`; правка заголовка вже вийшлого SCHEDULED → 200; 23 невалідні тіла створення → 400 з правильним кодом і **жодного** створеного рядка; backdating з `+02:00` → UTC; PUBLISHED ⇄ DRAFT ⇄ ARCHIVED (дата скидається / зберігається); DELETE → `{ id }`, повтор / PUT видаленого → 404, рядок лишився; жодного PUBLISHED / SCHEDULED без дати
  - **контрольні прогони:** предикат буквально з розділу 8 (`status = PUBLISHED`) → 3 ❌ саме на запланованому (баг плану підтверджено); предикат v4 (лише `deletedAt`) → стрічка падає на захисному `requirePublishedAt` (чернетка без дати в публічній відповіді)
  - web SSR (`next dev` + API з тим самим набором модулів): `/ua` — EN-only пост з бейджем і `sr-only` текстом; `/ua/news/<en-only>` — банер «Переклад недоступний — показуємо оригінал (англійська).», `<article lang="en">`, `<title>` з заголовка; перекладений пост — `lang="uk"`, банера немає; `/en/…` — банера немає; неіснуючий slug → **404**
  - тестові юзери / пости / теги прибрано (у БД — 3 seed-пости)
- [x] `tsc` API: 45 → **35** (posts, languages — 0; `likes/like.repository.ts:218` — Фаза 4); `pnpm build` web + admin ✅; `eslint` API по змінених файлах чистий, web — лише старі попередження `<img>`
- ⚠️ **Для Фази 4:** тред коментарів для поста створювати лише для **живого** поста (`livePostWhere`), `GET /comments/post/:postId` для неживого — 404 (зараз коментарі чернетки доступні за id поста, як і лайки були до P3-1)
- ⚠️ **Для Фази 6:** `packages/types` для постів уже v5 — лишаються `Match.kickoffAt` тощо; `CLAUDE.md` — секції Posts / Languages оновлено тут
- Свідомо не робимо (див. 3.1): `hreflang` / `canonical`, редагування поста в адмінці, пагінація `admin/all`

#### Рев'ю Фази 3 (2026-09-26)
Звірено код з пунктами 3a, P3-1…P3-10 і розділом 8; граничні випадки — пробами на dev-БД (тимчасовий Nest, як у 3a). Знайдено й виправлено:
- [x] **`publishedAt: null`** проходив `@IsOptional`, сервіс робив `new Date(null)` → PUBLISHED з датою **1970-01-01** (і `PUT { publishedAt: null }` переписував дату живого поста). Тепер `null` = не передано (`post.service.ts`), тип DTO `string | null`
- [x] **Lost update:** `update` завжди писав `status` / `publishedAt`, обчислені з прочитаного на початку запиту стану → правка заголовка перезаписувала статус, який інший адмін встиг змінити (запланований пост ставав чернеткою). Тепер публікація пишеться лише якщо змінюється (`isSamePublication`); лишається last-writer-wins для двох **одночасних змін статусу** — прийнятно. Перевірено підміною застарілого читання; контрольний прогін без фіксу → `DRAFT`, дата `null`
- [x] **413 на валідному пості:** межа контенту 100 000 символів проти дефолтних 100 KB тіла Express — UA-переклад максимальної довжини (≈ 200 KB) не зберігався. `JSON_BODY_LIMIT = '1mb'` (`app.constants.ts`, `app.setup.ts` — `useBodyParser`); > 1 MB → 413
- [x] **`?page=1e20` → 500** (`skip` не влазить в int64) → `@Max(100 000)` → 400
- [x] Спрощено: суфікс slug-а — `randomBytes(3)` → hex замість `BigInt` → base36
- Перевірено й **без проблем:** лайки — і `GET stats`, і `toggle` йдуть через `assertPostExists` (правило видимості покриває обидва); web SSR ходить з `cache: 'no-store'` (знятий з публікації пост зникає одразу); тіло-масив / `translations: [null]` / `"x"` / порожнє тіло → 400; `status: null` → DRAFT; старих полів (`published`, `coverImage`, `translations`, `getTranslation`) у web / admin / types не лишилось; регресія переходів DRAFT ⇄ PUBLISHED ⇄ ARCHIVED → SCHEDULED, backdating, колізія slug — ✅
- [x] `tsc` API: **35** (posts, languages, app — 0); jest 54/54; `eslint` чистий; тестові дані прибрано
- Відоме, не виправляємо: EN-заголовок без латиниці (кирилицею) → slug `post` / `post-<hex>` (деградація, не помилка); `generateMetadata` для неіснуючого поста дає title «Не вдалося завантажити пост» на сторінці 404 (косметика)

### Фаза 4 — Engagement
- [ ] `CommentThreadRepository.getOrCreateForPost/Match` (upsert за `postId`/`matchId`)
- [ ] `CommentService.create`: `threadId`, `rootId` = `parent.rootId ?? parent.id`, `depth` = `parent.depth + 1` (ліміт `MAX_COMMENT_THREAD_DEPTH`), інкремент `parent.replyCount` і `thread.commentCount` в одній транзакції; перевірка `thread.isLocked`
- [ ] Прибрати рекурсивний `depthFromRoot`
- [ ] Тред для поста — лише для живого (`livePostWhere`, P3-1); `GET /comments/post/:postId` неживого → 404
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
