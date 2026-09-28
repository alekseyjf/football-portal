# ⚽ Football Portal — Master Plan & Rules

> **Версія плану:** 4.7 (схема БД v5 — увесь код на ній; локалі лише `en`/`ua`; Accept-Language ISO `uk*` → `ua` у proxy; football — підмодулі Nest + порт провайдера)
> **Автор:** Олексій
> **Останнє оновлення:** 28 вересня 2026 — хвости проміжного плану закрито (часовий пояс дат, soft 404 матчу, мобільний навбар, ESLint), проміжний план → `docs/archive/football-plan-intermediate.md`; **рев'ю архітектури перед етапом 7** — розділ «🧭 Рішення перед етапом 7» і пункти в етапах 7, 8, 12, 14, «Тести». Далі того ж дня: **одна загальна 404** (раніше падала з «Missing <html> and <body>»), **сторінка матчів дня** `/matches` + `GET /football/matches?from&to` (7.0 / 7.3), назва матчу у вкладці
> **Зараз:** **етап 7** (альфа football UI + агреговані ендпоінти), паралельно — **8.2** (коментарі на матчі)

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
  module.repository.ts   ← ТІЛЬКИ Prisma запити (select-константи + типи рядків)
  module-response.ts     ← форма публічної відповіді: чисті функції toPublic*(row) (post-response.ts, football-response.ts)
  dto/
    create-X.dto.ts      ← ЛИШЕ вхідні дані (class-validator)
    update-X.dto.ts
```
Mapper (`*.mapper.ts`) — лише для зовнішніх API (Rule 4); відповіді API — не DTO-класи, а `toPublic*`.

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

**Rule 4 — Mapper для зовнішніх API (порт + адаптер)**
```typescript
// integration/football-provider.port.ts — інтерфейс FootballProvider + нейтральні Provider* типи
// integration/football-data/football-data.mapper.ts — ЄДИНЕ місце, що знає формат football-data (Fd*)
// Якщо API зміниться → міняємо тільки адаптер; новий провайдер = новий адаптер + значення DataProvider
```

**Rule 5 — DTO на вході, `toPublic*` на виході**
```typescript
// Вхідні дані → DTO з валідацією (class-validator; межі — packages/validation)
// Вихідні дані → select{} в Prisma + toPublic*(row) у *-response.ts (ніколи не повертати зайве)
// DTO ≠ Entity: DTO для API, Entity для бізнес-логіки
```

**Rule 6 — select замість include**
```typescript
// Завжди явно вказувати які поля повертати
// Ніколи не повертати passwordHash / email чужих, навіть випадково через join
select: { id: true, profile: { select: { displayName: true } } } // ✅ (автор — PUBLIC_AUTHOR_SELECT)
include: { author: true }                                        // ❌ може потягнути зайве
```

**Rule 7 — Soft Delete для модерованого контенту**
```typescript
// Post і Comment мають deletedAt DateTime?
// "Видалення" = встановити deletedAt, не DELETE з БД
// Запити фільтрують: where: { deletedAt: null }
// Коментар: soft delete ховає й усю гілку відповідей під ним (Фаза 4)
// Єдиний виняток — ADMIN purge коментаря (legal / GDPR, D20): /comments/:id/purge, /purge-thread
```

**Rule 8 — Email завжди lowercase**
```typescript
// В сервісі перед збереженням:
email = dto.email.toLowerCase().trim();
```

**Rule 9 — i18n через Translation таблиці**
```typescript
// Контент (title, excerpt, content) → PostTranslation (languageCode → таблиця Language)
// Мета-дані (slug, status, publishedAt, coverImageUrl) → Post
// Запит завжди з `lang`; fallback на default-мову (en) робить API, відповідь несе `resolvedLanguage`;
// невідома / неактивна мова → default без 400 (LanguageService, кеш 60 с)
```

**Rule 10 — Транзакції й гонки (уроки Фаз 2–4 і рев'ю)**
```typescript
// Лічильники й інваріанти — у ТІЙ САМІЙ транзакції, що й рядки;
//   умовний updateMany({ where: { id, deletedAt: null } }) → count — атомарна перевірка стану
// Блокування — завжди в одному порядку: предки → нащадки → агрегат (тред) останнім;
//   FOR NO KEY UPDATE, не FOR UPDATE (той конфліктує з FK KEY SHARE вставок → deadlock)
// Prisma 7 + driver adapter: upsert не гарантує атомарності (паралельні вставки → P2002);
//   deadlock приходить як P2010 / DriverAdapterError, НЕ P2034 → помилки лише через src/prisma/prisma-errors.ts
// Кожну гонку — перевірити детерміновано (блокування тримає окрема транзакція) + контрольний прогін без фіксу
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
// next-intl у src/proxy.ts (Next 16 — proxy замість middleware) визначає мову
```

**Rule 7 — Дати лише через спільний форматер (з 2026-09-28)**
```typescript
// ✅ const formatDateTime = useDateTimeFormat();  formatDateTime(match.kickoffAt, { dateStyle: 'full', timeStyle: 'short' })
// ✅ RSC: formatDateTime(iso, locale, await getTimeZone(), options)  — lib/i18n/date-time.ts
// ❌ new Date(iso).toLocaleString(...)  — пояс процесу: SSR (UTC) ≠ браузер → hydration mismatch
// Пояс — next-intl (i18n/request.ts: cookie `tz` від TimeZoneSync, інакше Europe/Kyiv); день «сьогодні» / межі дня — у тому ж поясі
```

**Rule 8 — Сторінка з параметром у URL**
```typescript
// Сутність за slug / id → fetchQuery (не prefetchQuery — той ковтає помилки) + notFound() лише на 404 від API;
// інші збої — рендер без кешу, клієнт зробить refetch (news/[slug], matches/[id])
// generateMetadata і сторінка читають ту саму сутність → одна функція в React cache(), без двох запитів до API
//   (matches/[id]: const getMatchDetail = cache(fetchMatchDetail))
// 404 (з 2026-09-28) — ОДНА загальна app/not-found.tsx: свій <html>/<body> (кореневий layout повертає лише children),
//   мова — getLocale() next-intl, без навбару; [locale]/not-found і catch-all [...rest] свідомо НЕ робимо.
//   Невідомий URL → /_not-found, повний SSR; кинутий notFound() сторінки → у Next 16 SSR-HTML — оболонка
//   __next_error__, 404 малює клієнт (так і в мінімальному стандартному застосунку — поведінка фреймворку);
//   статус 404 і noindex — є. Посилання на ще не існуючі сторінки — prefetch={false}: prefetch 404-маршруту
//   в Chrome лишається «незавершеним» (клієнт Next не дочитує тіло) → networkidle ніколи не настає
```

---

## 🔐 Правила безпеки (Security Rules)

**Backend (цільовий набір):**
- `class-validator` у ВСІХ DTO — обов'язково
- `Helmet` — security headers (**є**, Фаза 2d: `app.setup.ts`, CORP `same-site`, без `X-Powered-By`)
- `CORS` — явно вказані origins + `credentials: true` (**є**, `app.setup.ts`)
- Rate limiting — `@nestjs/throttler` на auth-роутах (**є**, Фаза 2d — див. «Ліміти спроб» нижче)
- `Cache-Control: no-store` на відповідях з персональними даними / токенами (`register`, `login`, `refresh`, `me`)
- `TRUST_PROXY` — за reverse proxy на проді **обов'язково** (кількість проксі, напр. `1`; `true` заборонено — IP підробляється через `X-Forwarded-For`)
- Паролі — bcrypt, saltRounds = 10; новий пароль — 8…72 **байти** UTF-8 (bcrypt обрізає по байтах; кирилиця — 2 байти на літеру), межі — `packages/validation` (**є**)
- Access-JWT 15 хв (HS256, `{ sub, role, sid }`) + **opaque refresh у БД** (SHA-256): ротація, reuse detection, ковзне вікно 7 д, абсолютний ліміт 30 д; `JwtStrategy` на кожен запит перевіряє живу сесію й бере роль / статус з БД; httpOnly cookies, `sameSite: 'lax'`, refresh-cookie лише на `/api/v1/auth` (**є**, Фаза 2)
- Без секретів API не стартує: `JWT_SECRET`, `EMAIL_HASH_SECRET` (≥ 32 символи), `CORS_ORIGINS` (рівно origin-и, на проді лише https); на проді — `TRUST_PROXY` (**є**)
- Анти-абуз коментарів / лайків — `RateLimitEvent` + `UserSanction`: cooldown 60 с між коментарями, burst 5 за 5 с → бан на дію 24 год, повторний strike → `LOCKED` + відкликання сесій (**є**, Фаза 2c)
- Ніколи не повертати `password` у відповіді API
- `whitelist: true` у ValidationPipe — видаляє зайві поля (**є**)
- Email — завжди toLowerCase() перед збереженням (**є** в auth)

**Ліміти спроб (Фаза 2d, `security/throttling/`):**

| Роут | Ліміт |
|---|---|
| `POST /auth/login` і `/auth/login/admin` (спільний лічильник) | 10/хв з IP **і** 10 за 15 хв на один акаунт (email) |
| `POST /auth/register` | 5 за 10 хв з IP |
| `POST /auth/refresh` | 30/хв з IP |
| `DELETE /users/me` | 5 за 15 хв на користувача (підтвердження паролем) |
| `POST /football/live-touch` (публічний, витрачає квоту провайдера) | 10/хв з IP; + LIVE-синк турніру не частіше 60 с (через `SyncRun`) |

- Ліміт **на акаунт** — бо ліміт лише на IP не зупиняє розподілений перебір пароля одного акаунта з багатьох IP. Ціна: чужими запитами можна тимчасово заблокувати вхід жертві — тому поріг помірний
- Ліміти **лише на цих роутах**, не глобально: SSR Next.js ходить з одного IP сервера — глобальний ліміт на IP душив би всіх відвідувачів разом
- 429 `TOO_MANY_REQUESTS` + заголовки `Retry-After-ip` / `Retry-After-account` (у CORS `exposedHeaders`). Фронт: 429 від `/auth/refresh` — **не** розлогінювати, повторити пізніше
- Сховище — пам'ять процесу (скидається рестартом). На проді з кількома інстансами — **Redis-сховище** для throttler

**CSRF (окремо від JWT у cookie):**  
Куки з `SameSite=Lax` вже зменшують класичний CSRF з чужого сайту. Для **defence in depth** перед продакшеном варто додати перевірку для мутацій (заголовок + секрет у cookie або double-submit). Пакет **`csurf` застарілий** — при імплементації краще дивитись на актуальні підходи для Express/Nest 11 (власний middleware, `@edge-csrf/*`, або політика тільки для same-site API + суворий CORS). Не плутати з **Next.js**: подвійний домен (web 3000, api 4000) — це cross-origin; CSRF-токен має видавати API і фронт передає його в заголовку на мутації.

**Frontend:**
- `DOMPurify` для будь-якого user-generated HTML (зараз HTML не рендериться: контент — текстом, `dangerouslySetInnerHTML` у web / admin немає — перевірено в рев'ю Фаз 1–4)
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
- `strict: true` у tsconfig web / admin / packages; **API — виняток** (Nest-дефолт: `strictNullChecks`, але `noImplicitAny: false`) — увімкнути окремим PR, коли буде час розібрати помилки
- Ніяких `any` → використовуй `unknown` або явний тип (ESLint API ловить `no-unsafe-*`)
- Shared типи у `packages/types` (API їх поки **не** імпортує — див. «🧭 Рішення перед етапом 7», п. 8)

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

# ЧАСТИНА 2 — СХЕМА БД (v5)

> **Джерело правди — код:** `apps/api/prisma/schema.prisma` + ручні обмеження `apps/api/prisma/sql/constraints.sql` (CHECK і часткові унікальні індекси, яких Prisma не виражає). Схему тут **не дублюємо**: копія v4 у цьому файлі застаріла, щойно змінився код.
> **Звідки v5:** проміжний план — ✅ завершено 2026-09-27, в архіві: `docs/archive/football-plan-intermediate.md` (розділи 2–6 — рішення, схема, синк; Фази 0–7 — P2-* … P5b-*, рев'ю R*, журнал перевірок). Схему застосовано у Фазі 1 (2026-09-26); код доменів переведено у Фазах 2–4; FOOTBALL / SYNC — Фаза 5 (5a, 5b).

## 🗺️ Домени

```
IDENTITY      User · UserProfile · AuthSession
MODERATION    UserSanction · RateLimitEvent · BlockedEmail
CONTENT       Language · Post · PostTranslation · Tag · TagTranslation · PostTag · PostCompetition · PostClub
ENGAGEMENT    CommentThread · Comment · PostLike · CommentLike · MatchLike · UserReactionActivity
FOOTBALL      Area · Competition · Season · SeasonClub · Club · Match · Standing
SYNC          CompetitionExternalRef · SeasonExternalRef · ClubExternalRef · MatchExternalRef · SyncRun
```

Правило залежностей: **FOOTBALL не знає про провайдерів** (жодного `externalId` у доменних таблицях); про провайдерів знає лише SYNC + `football/integration/`.

| Домен | Стан коду |
|---|---|
| Identity, Moderation | ✅ Фаза 2 — сесії, санкції, блоклист пошт, видалення акаунта (анонімізація) |
| Content | ✅ Фаза 3 — статуси й дата публікації, переклади з fallback, теги / турніри / клуби поста |
| Engagement | ✅ Фаза 4 — треди коментарів, soft delete гілкою, purge, лайки |
| Football, Sync | ✅ Фаза 5 — порт провайдера + адаптер football-data, `*ExternalRef`, сезони (`isCurrent`), `SyncRun` (журнал + лок), дельта-синк; перемикач ліг і вигляд кубка в сайдбарі (5b) |

### Ключові рішення схеми (D1–D20)

| # | Рішення | Чому |
|---|---|---|
| D1 | `League` → **`Competition`** (`type: LEAGUE \| CUP`) | ЛЧ, кубки, ЧС — не «ліги» |
| D2 | **`Season`**; `Match` і `Standing` прив'язані до сезону | Історія сезонів, перехід сезону без втрат |
| D3 | `Club` без `leagueId`; участь — **`SeasonClub`** (M:N) | Клуб грає в PL і CL одночасно |
| D4 | **`Standing`** з `stage`, `groupName`, `type` | Групи ЛЧ, кілька таблиць в одному сезоні |
| D5 | `externalId` → таблиці **`*ExternalRef`** `(provider, externalId)` | Новий провайдер без міграції доменних таблиць |
| D6 | **`SyncRun`** — журнал і лок синку | Видно, що синкнулось; два синки одного турніру неможливі |
| D7 | Турніри для синку — з БД (`Competition.isActive`) | Новий турнір без редеплою |
| D8 | **`Language`** — таблиця | Нова мова = `INSERT` + файл перекладів на web |
| D9 | Fallback контенту: запитана мова → default (`en`) | Відповідь несе `resolvedLanguage` |
| D10 | `Post.published` → **`status`** (`DRAFT` / `SCHEDULED` / `PUBLISHED` / `ARCHIVED`) + **`publishedAt`** | Чернетки, відкладена публікація без cron |
| D11 | **`CommentThread`** — одна гілка на пост / матч | Один FK у коментаря; тут `isLocked`, `commentCount` |
| D12 | `Comment.rootId` + `depth` + `replyCount` | Гілка одним запитом, без рекурсії |
| D13 | `User` = лише ідентичність; **`UserProfile`** 1:1 (`displayName`, `avatarUrl`, `bio`) | Auth-запити не тягнуть профіль |
| D14 | **`UserSanction`** + **`RateLimitEvent`** | Історія санкцій, strikes, ручні бани |
| D15 | **`AuthSession`** — refresh у БД (хеш), ротація, reuse detection | Logout справді відкликає |
| D16 | **`PostCompetition`**, **`PostClub`** | Новини турніру / клубу окремо від тегів |
| D17 | **`TagTranslation`** | Теги з тим самим fallback, що й пости |
| D18 | `Match.stage` — String | Нова стадія провайдера не ламає синк |
| D19 | Видалення користувача = **анонімізація**, не `DELETE` | Пости / коментарі цілі, `Restrict` не заважає |
| D20 | Коментар: soft delete + **ADMIN purge** | Legal / GDPR; purge лише листка або всієї гілки |

Повні формулювання й обґрунтування — `docs/archive/football-plan-intermediate.md`, розділ 2.

### Спроєктовано, але ще не створено (адитивно — коли знадобиться)
> Перенесено з розділу 9 проміжного плану. Принцип: **структурні** зміни (зв'язки, ключі, кардинальність) — до релізу; **адитивні** (нова таблиця, nullable-колонка, значення enum) — коли знадобиться, без переробок.

| Сутність | Етап | Як ляже |
|---|---|---|
| `Player`, `PlayerExternalRef`, `SquadMember { seasonId, clubId, playerId, shirtNumber, position }` | 7.4 | Нові таблиці, прив'язка до `Season` вже є; синк — за правилами 4.3 |
| `MatchEvent { matchId, minute, type (GOAL/CARD/SUB), clubId, playerId? }` | 15 | Нова таблиця |
| `ClubTranslation`, `CompetitionTranslation` | за потреби | Нові таблиці + fallback на `Club.name` / `Competition.name` (як `TagTranslation`) |
| `PostPlayer`, `PostMatch` | за потреби | Як `PostClub` |
| `CommentThread.clubId` / `playerId` | за потреби | Nullable колонка + оновити CHECK `CommentThread_single_target_check` |
| `ContentReport { reporterId, commentId, reason, status }` | 16 | Нова таблиця |
| `MatchPrediction { userId, matchId, homeScore, awayScore, points }` | після MVP | Нова таблиця |
| `UserFavoriteClub { userId, clubId }` | 10 | Нова таблиця |
| `AuthAccount { provider, providerAccountId, userId }` (OAuth) | за потреби | Нова таблиця; `passwordHash` → nullable |
| `EmailVerificationToken`, `User.emailVerifiedAt` | 13.5 | Нова таблиця + nullable-колонка |
| `MediaAsset` (Cloudinary, alt по мовах) | 14+ | Нова таблиця; `coverImageUrl` лишається як кеш |
| `PostRevision` | за потреби | Нова таблиця |
| `Match` з невизначеними учасниками (TBD) | 7.1 (сітка) | `homeClubId` / `awayClubId` → nullable (`DROP NOT NULL`), синк перестає пропускати TBD — див. «🧭 Рішення перед етапом 7», п. 7 |

---

## 📌 Prisma та міграції — **рішення на зараз** (узгоджено)

- **`LikeType`:** залишаємо **`enum LikeType { LIKE DISLIKE }`**, **без** переходу на `String` + CHECK, доки немає реальної потреби.
- **Атомарність:** створення / оновлення поста — одна nested-операція (поля + переклади + зв'язки); багатокрокові зміни з лічильниками — `$transaction` за правилом 10 Частини 1.
- **Інваріанти, яких Prisma не виражає**, — у `prisma/sql/constraints.sql`: рівно одна ціль треду, різні клуби матчу, опублікований / запланований пост має дату, одна default-мова, один поточний сезон турніру, один `RUNNING` синк на ціль, формат анонімізованих email.
- **Squash до релізу** (розділ 11 архівного проміжного плану): поки немає прод-БД, історію міграцій схлопуємо — `migrate reset` → `migrate dev --name init --create-only` → **дописати `constraints.sql` у baseline** → `migrate dev` → `db seed`. Останній squash — безпосередньо перед релізом (етап 14): прод стартує з однієї `0001_init`. Зараз міграцій чотири: `0001_init` … `0004_auth_session_absolute_lifetime`.
- **Після релізу:** застосовані міграції не редагуємо й не видаляємо; структурні зміни — expand → backfill → contract (окремі міграції / деплої); кожну міграцію генеруємо з `--create-only` і читаємо SQL (Prisma любить `DROP` + `ADD` замість `RENAME`; перевіряти, що не зникли об'єкти з `constraints.sql`); `pg_dump` перед кожним `migrate deploy`.
- Supabase: `migrate` іде через `DIRECT_URL` (`prisma.config.ts`).

---

## 🧭 Синтез external senior review (коротко)

| Тема | Висновок |
|------|----------|
| Helmet | ✅ Фаза 2d (`app.setup.ts`); rate limiting на auth — теж ✅ 2d |
| CSRF | Високий пріоритет до публічного прод; імплементація під Nest + cross-origin (web/api); **не** покладатись на застарілий `csurf` без аудиту |
| Winston / Pino | Після структурованого Nest `Logger` — коли знадобляться файли / агрегація |
| `@nestjs/event-emitter` | Не зараз; коли 2+ підписники на подію або черги |
| Zustand | Вже є для auth — без змін «з нуля» |
| `GET /auth/me` + refresh | ✅ Фаза 2e — відновлення сесії після F5, refresh-on-401 (single-flight) у web і admin |

### Короткий backlog якості (без зайвих міграцій)

1. ~~**Helmet**~~ ✅ Фаза 2d (`app.setup.ts`)
2. ~~**`@nestjs/throttler`**~~ ✅ Фаза 2d — на IP і на акаунт
3. **Валідація `process.env`** при старті — ◐ частково: без `JWT_SECRET` / `EMAIL_HASH_SECRET` (≥ 32), `CORS_ORIGINS`, на проді `TRUST_PROXY` API не стартує; решта (`DATABASE_URL`, `FOOTBALL_*`) — без схеми
4. ~~**Ліміти в DTO**~~ ✅ Фази 2f і 3 (`packages/validation` — ті самі числа в DTO і формах)
5. **CSRF** (double-submit cookie + заголовок) під схему портів 3000 → 4000 — ◻
6. **Файлові логи** — за потреби

---

## 🎯 Альфа-реліз: карта сторінок (web) + правила інтеграції


### Відмінності від generic prompt (важливо для Cursor / розробки)

| У prompt | У проєкті |
|----------|-----------|
| Generic prompt з `/uk/...` | У проєкті лише **`/ua/...`** і `messages/ua.json`. У Accept-Language браузер може надіслати стандартний код **`uk`** — у `proxy.ts` викликається **`normalizeAcceptLanguageForAppLocales`** (`accept-language.ts`), щоб next-intl бачив **`ua`**. Для `Intl` / дат лишається **`uk-UA`** у `content-lang.ts` (не сегмент URL). |
| `Competition` / `Team` / `Standing` | З v5 назви майже збігаються: **`Competition`** (`type: LEAGUE \| CUP`), **`Season`**, **`SeasonClub`**, **`Club`**, **`Standing`**. Публічні роути лишаються `football/leagues/:slug/…` (`?season=2025-26` / `2026`, без параметра — `isCurrent`): `leagues`, `:slug`, `dashboard`, `standings`, `clubs`, `matches?stage`, `fixtures`, `matches/:id` — ✅ Фаза 5 (перелік — `CLAUDE.md`, Football) |
| `teamId` у шляху | Краще **`[clubSlug]`** (є `Club.slug`); внутрішній `id` — для API за потреби |
| Окремі Nest-модулі `competitions`, `teams`, … | **Один** кореневий `FootballModule` + **внутрішні підмодулі**: `FootballIntegrationModule` (зовнішнє API), `FootballPersistenceModule`, `FootballQueryModule`, `FootballSyncModule` — див. **етап 5b** та дерево в **актуалізації**. |
| Модель `Player` у схемі | **Поки немає** в Prisma; спроєктовано `Player` / `SquadMember` (Частина 2, «Спроєктовано, але ще не створено») — сторінки **squad** / **players** після окремої міграції + синку |
| Крок «додати i18n» | **Вже зроблено** (next-intl, `app/[locale]`) — у плані альфи не повторювати |

### Глобальні вимоги альфи

- **i18n:** усі нові екрани — ключі перекладів, маршрути тільки під `[locale]`.
- **Зовнішній API:** виклики **лише** з Nest через порт `FootballProvider` (адаптер `integration/football-data/`); фронт — **тільки** `NEXT_PUBLIC_API_URL` / `lib/api/http.ts`. Read-ендпоінти читають **лише нашу БД** — провайдера на запит користувача не викликаємо (виняток — `live-touch`).
- **Ліміти football-data.org:** 10 запитів / хв — одна черга на процес (≥ 6,5 с між стартами), повний синк — 4 запити на турнір. Кеш на бекенді (in-memory, TTL **60–300 с**) для агрегованих read-ендпоінтів — щоб не навантажувати БД; інвалідація — по завершенню `SyncRun`. Redis — коли буде кілька інстансів API.
- **Дані:** агрегаційний шар у бекенді (один відповідь = таблиця + найближчі матчі + список клубів тощо), щоб зменшити чатання з фронта.
- **Безпека:** httpOnly JWT, Helmet, throttler — ✅; **CSRF на мутації** — ◻ до публічної альфи (див. **«Короткий backlog якості»** вище).
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
  page.tsx                  ✅ матчі дня (?date=, ?league=) — 2026-09-28
  [id]/page.tsx             ✅ деталь матчу
calendar/
  page.tsx                  ◻ календар по матчах з БД
```

### Порядок імплементації (щоб не змішувати шари)

| Крок | Backend | Frontend |
|------|---------|----------|
| **A** | Передумова — **Фаза 5 проміжного плану** ✅ (синк v5, поточний сезон `isCurrent`, ендпоінти 6.4). Спершу — e2e + CI (🧭 п. 9) і контракт типів (🧭 п. 8); далі **football** (**етап 7.0**): агреговані ендпоінти + **кеш TTL** на read (🧭 п. 4) | — |
| **B** | — | `leagues/` + `[leagueSlug]/standings|matches|clubs` (реюз UI з сайдбару де можливо) |
| **C** | — | `clubs/[clubSlug]/` + `matches/` підмаршрут |
| **D** | — | `matches/page.tsx` (загальний список) |
| **E** | — | `calendar/page.tsx` |
| **F** | Опційно: міграція **Player** + синк з API (якщо доступно в тарифі) | `squad` + `players/[id]` |

### UX-орієнтир

Структура навігації в дусі SofaScore / Flashscore / ESPN: **ліга → таблиця / матчі → клуб → матч**; зрозумілі хлібні крихти та посилання з головної.

---

## 🧭 Рішення перед етапом 7 (рев'ю архітектури, 2026-09-28)

> Звірка плану з кодом після v5. **Каркас правильний і лишається:** домени з чіткими межами, наша БД — джерело правди, порт провайдера + дельта-синк, `SyncRun`-лок, season-aware query-шар, `?season=` у URL, правило 10 (гонки). Нижче — рішення, які дешевше прийняти **до** коду етапів 7–8 і 14, ніж переробляти після. На пункти посилаються етапи («🧭 п. N»).

**1. Новини ліги / клубу — через posts, не через football.** Hub ліги й сторінка клубу — два паралельні prefetch-и на сервері: football-агрегат + `GET /posts?competition=PL` / `?club=<slug>` (фільтр за `PostCompetition` / `PostClub`, slug-и; разом з `?tag=` етапу 9 — один `ListPostsQueryDto`). `FootballModule` **не** імпортує posts: залежність лише content → football (як зараз), інакше кеш і інвалідація football змішаються з редакційним контентом.

**2. «Сезон» клубу — наскрізно за турнірами.** `Season` — на турнір (PL 2025/26, CL 2025/26, WC 2026), а сторінка клубу показує PL + CL + кубок разом. Рішення: `GET /football/clubs/:slug/matches?season=2025-26&competition=PL&page=` — `season` = `Season.label` у всіх турнірах клубу (у клубів ліга й ЛЧ мають однаковий label; у збірних label = рік турніру); без параметра — поточні сезони турнірів, де клуб є в `SeasonClub`. Позиції в таблицях — `Standing` поточних сезонів (`TOTAL`).

**3. Календар / матчі за датою — інтервал в UTC, день — у поясі користувача.** «Сьогодні» в Києві й у Лондоні — різні інтервали UTC. API: `GET /football/matches?from=<ISO>&to=<ISO>&league=PL,CL` (≤ 31 день, лише `isActive`), **не** `?date=YYYY-MM-DD` без поясу. Web рахує межі дня в поясі next-intl (Rule 7 фронту) і групує матчі за днем тим самим форматером. `startOfUtcDay` у турах сайдбару — відоме спрощення (вночі за Києвом «сьогоднішні» матчі ще в «найближчих»), не переносити в календар.

**4. Кеш read-ендпоінтів (7.0) — конкретно.**
- Де: у `FootballQueryService` (не контролер / не репозиторій) — маленький `ReadThroughCache`: TTL, **single-flight** (паралельні промахи → один запит до БД), ліміт розміру.
- Ключі з тегом турніру (`competition:PL:dashboard:2025-26`); по завершенню `SyncRun` (повного й LIVE) інвалідується **лише цей турнір**, не весь кеш; `matches/:id` — теж тег турніру матчу.
- LIVE: турнір з матчем у LIVE-вікні — TTL ≤ інтервалу LIVE-синку (60 с) або інвалідація після нього.
- Спершу **виміряти** (p95 дашборду / hub ліги до і після): латентність Supabase домінує над самими запитами; якщо виграш малий — кеш лише на агрегатах.
- HTTP `Cache-Control` / CDN — не зараз: web SSR ходить з `cache: 'no-store'`, користі не буде (етап 14).

**5. Архів сезонів.** API не віддає список сезонів турніру (лише `currentSeason`) — для перемикача `?season=` на сторінках ліг потрібен `seasons: [{ label, isCurrent }]` (у hub-відповіді або `GET /football/leagues/:slug/seasons`).

**6. Межі параметрів публічних GET.** Глобального throttle немає свідомо (SSR ходить з одного IP) → кожен новий read-параметр обмежений: інтервал дат ≤ 31 день, `limit` ≤ 100, `page` ≤ 100 000, список ліг ≤ 20 slug-ів; невалідне → 400. Кеш (п. 4) — друга лінія.

**7. Сітка плей-оф і TBD-матчі.** Синк пропускає матчі без визначених учасників → у БД немає майбутніх пар плей-оф («Фінал · 19.07 · TBD – TBD»), календар і сітка неповні. Якщо сітка має показувати майбутні раунди — `Match.homeClubId` / `awayClubId` nullable (`DROP NOT NULL` — дешево й після релізу, але міняє типи, `toPublic*`, UI; CHECK `Match_distinct_clubs_check` з NULL проходить) + синк створює TBD-матч і оновлює, коли жеребкування. Провайдер **не** дає зв'язків «переможець матчу X → матч Y», тож «дерево» з лініями не побудувати: сітка = колонки стадій, пари за клубами (двоматчеві — сума, пенальті окремо). Вирішити на початку 7.1-«сітка».

**8. Контракт API ↔ web.** API не імпортує `@football-portal/types` (форма — `ReturnType<toPublic*>`), web вірить інтерфейсам вручну, константи (`MATCHDAY_STAGES`, `IN_PLAY_MATCH_STATUSES`) продубльовано. Етап 7 додасть 5–8 відповідей → тихе розходження. На старті 7.0: `packages/types` збирати в `dist` (як `validation`; інакше `rootDir: ./src` API не пустить вихідники), `toPublic*` у API — `satisfies <тип з пакета>`, константи — з пакета.

**9. Постійні інтеграційні тести й CI — на старті 7.0, а не в кінці.** У Фазах 2–5 тимчасові скрипти (сотні перевірок, фейковий провайдер з «воротами», справжні HTTP з cookies) писались і видалялись щоразу. Перенести їх ядро в `apps/api/test/` (e2e на **окремій** БД — локальний Postgres у Docker; не dev-Supabase, де лежить справжній синк), плюс GitHub Actions: lint + typecheck + unit + e2e. В `apps/admin` ESLint не встановлено — додати разом із CI.

**10. Коментарі на матчі (8.2) — три передумови.**
- `CommentSection` / `useComments` прив'язані до поста (`postId` у ключі й тілі) → винести в `components/comments/` з ціллю `{ type: 'post' | 'match', id }`, ключ `['comments', type, id]`.
- **N+1 лайків:** кожен вузол дерева робить свій `GET /likes/stats/comment/:id` (+ перевірка сесії в `JwtStrategy` на кожен) → 100 коментарів = 100 HTTP + ~200 SQL. Дерево має віддавати `likeCount` (уже денормалізовано в `Comment`) і `myReaction` пачкою (один `CommentLike where userId, commentId IN (…)`), `LikeBar` — початкові дані з дерева.
- Рішення 8.1 «сплющувати як YouTube чи дерево» — **до** пагінації: YouTube-модель (корені сторінками за `(createdAt, id)` + відповіді гілки за `rootId`, індекс `[rootId, createdAt]` є) пагінується просто, довільне дерево — ні. На матчах коментарів більше — пагінація одразу.

**11. Деплой: web і API на одному «сайті» (етап 14, вирішити до вибору хостингу).** Auth — httpOnly cookies `SameSite=Lax`. `*.vercel.app` + `*.up.railway.app` — **різні сайти**: браузер не надішле cookies у `fetch` до API, Safari ITP теж ріже → логін не працюватиме. Варіанти: свій домен з піддоменами (`example.com`, `api.example.com`, `admin.example.com` — same-site) **або** API через rewrites Next (`/api/v1/*` → API, same-origin; тоді SSR зможе передавати cookies). `CORS_ORIGINS` = web + admin, `secure` cookies, `path` refresh-cookie = шлях, який бачить браузер.

**12. Один інстанс API — явне обмеження.** У пам'яті процесу: throttler, черга football-data, кеш 7.0 і його інвалідація, `@Cron`. Поки API = 1 репліка — ок. Друга репліка = подвійні cron-и (лок `SyncRun` не дасть двох синків одного турніру, але LIVE-cron і квота діляться), розсинхрон кешу й лімітів → Redis + cron / синк в окремому worker-процесі.

**13. Спостережуваність проду (в плані не було).** Sentry (web / admin / API, безкоштовний рівень), `GET /health` (DB ping) для Railway, алерт на `SyncRun FAILED` N разів поспіль (інакше football-дані мовчки застаріють), очищення старих `SyncRun`.

**14. Пояс дат і статичний рендер.** Зроблено (2026-09-28): пояс — cookie `tz` у `getRequestConfig` → **усі** маршрути динамічні (auth-сторінки теж, раніше SSG). Для поточної архітектури (SSR + prefetch, дані — `no-store`) ціни майже немає. Якщо знадобиться ISR / Full Route Cache для сторінок ліг — пояс на клієнті після гідрації (`useSyncExternalStore`, спершу пояс сервера) або фіксований пояс; на Vercel без cookie — заголовок `x-vercel-ip-timezone` як fallback.

**15. Мобільна навігація — разом з 7.1, не в етапі 12.** Посилання «Новини / Ліги / Клуби» в навбарі — `hidden md:flex`: щойно з'являться сторінки 7.1 / 7.2, на телефоні до них не буде шляху з меню. Бургер (з ім'ям користувача й адмінкою, які зараз сховано на вузьких екранах) — у тому ж PR, що й перші сторінки ліг.

---

# ЧАСТИНА 3 — ПЛАН РЕАЛІЗАЦІЇ
> **Як читати:** нижче — етапи з чекбоксами `[x]` / `[ ]`. Щоб не роздувати файл, **детальний знімок** (що саме вже зроблено в репо) винесено в **«Актуалізація плану»** в кінці документа.
>
> **Порядок робіт (не змішувати):** проміжний план — ✅ (Фази 0–7, 2026-09-27; хвости — 2026-09-28), в архіві `docs/archive/football-plan-intermediate.md`. Далі цей план — **7** (альфа football UI + агрегація API) → **8** (коментарі на матчі) → **9+** за номерами. Етап **6** (лайки) — ✅.

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
- **v5 (Фаза 2 проміжного плану, 2a–2f):** `AuthSession` (opaque refresh, ротація, reuse detection, 7 д ковзне / 30 д абсолютне), `sid` у access-JWT, `logout-all`, `POST /auth/login/admin`; `UserProfile`; видалення акаунта (`DELETE /users/me`, `DELETE /users/:id`) — анонімізація + блок пошти (HMAC); анти-абуз (`UserSanction` / `RateLimitEvent`); throttling, Helmet, суворий CORS; web / admin — відновлення сесії після F5 і refresh-on-401

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
- [x] v5 (Фаза 5b проміжного плану): перемикач ліг (`?league=`, «Ліги» / «Кубки»), сайдбар у SSR з даними, кубки — таблиця ліга-фази / групового етапу, тури за стадіями (плей-оф — уся стадія), підписи стадій

### Етап 3.6 — TanStack Query (web + admin) ✅
- [x] `@tanstack/react-query` + DevTools у **apps/web** та **apps/admin**
- [x] `QueryClientProvider` через `providers/QueryProvider.tsx` у layout
- [x] `lib/query/queryClient.ts` — конфігурація `QueryClient`
- [x] Транспорт: **`lib/api/http.ts`** (`apiGet` / `apiPost` / `apiPut` / `apiDelete`), без окремого `client.ts`
- [x] Web: список постів і сторінка новини — `prefetchQuery` + `HydrationBoundary` + клієнтські `useQuery`; коментарі та auth — `useMutation` + `invalidateQueries` (logout — з 2e `markSignedOut`: `me = null` + інвалідація `likes`, без `queryClient.clear`, який ламав активних observer-ів)
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

**Зроблено (Фаза 2e):** `useAuthQuery` / `GET /auth/me` + refresh-on-401 — сесія переживає F5; Zustand лише дзеркалить кеш (`AuthSessionSync`).

---

### Етап 4 — Рефакторинг схеми + Football Module

#### 4.1 — Оновити Prisma схему v4.0 ✅ ЗАВЕРШЕНО (історично — замінено схемою v5, див. 4.4)
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
- [x] **v5 (Фаза 3):** `languageCode` (таблиця `Language`), `status` + `publishedAt` (Draft / Publish now / Schedule в адмінці), `coverImageUrl`; переклад розгорнуто у відповідь + `resolvedLanguage`; slug з EN-заголовка з суфіксом при колізії; `PUT` / `DELETE` — лише ADMIN; `tagIds` / `clubIds` / `competitionIds` з перевіркою існування

#### 4.3 — Football Module (NestJS) ✅ (v5 — Фаза 5 проміжного плану)
> Переписано у Фазі 5a (2026-09-26) і 5b (2026-09-27). Повні рішення — P5-1…P5-17, P5b-1…P5b-9, рев'ю R5a-* у `docs/archive/football-plan-intermediate.md` (Фаза 5); перелік ендпоінтів і файлів — `CLAUDE.md`, Football.

**Джерело правди — наша БД.** Провайдер — змінний постачальник (порт `FootballProvider`); публічні GET читають лише БД. Синк: cron + `POST /football/sync` (**202 Accepted**, фон без Bull).

**Архітектура модуля (`apps/api/src/football/`):**
- **`integration/`** — `football-provider.port.ts` (`FootballProvider`, DI-токен `FOOTBALL_PROVIDER`, нейтральні `Provider*`, `FootballProviderError`) + адаптер `football-data/` (`client` — одна черга запитів на процес, ≥ 6,5 с між стартами, 429 → чекати `X-RequestCounter-Reset`; `mapper` — **єдине** місце, що знає `Fd*`; `provider`). `FootballIntegrationModule`
- **`persistence/`** — `FootballRepository` (публічні читання), `FootballSyncRepository` (записи синку), `ExternalRefRepository` (batch resolve `*ExternalRef`), `SyncRunRepository` (журнал + лок). `FootballPersistenceModule`
- **`sync/`** — `FootballSyncService` (повний синк), `FootballLiveSyncService` (`live-touch` + LIVE-cron), `FootballLiveThrottleService` (інтервал через `SyncRun`), `FootballSyncWriter`, `football.cron.ts`. `FootballSyncModule`
- **`query/`** — `FootballQueryService` (усе в межах сезону), `football-response.ts`, `football-standings.util.ts`. `FootballQueryModule`
- **Корінь** — `football.controller.ts`, `football.module.ts`, `football.constants.ts`, `football-match-status.ts`, `football-matchday.util.ts` (тури за стадіями), `dto/`

**Cron:**
```
повний синк активних турнірів → @Cron('0 */2 * * *')  кожні 2 год (Competition.isActive, за sortOrder)
LIVE-синк                     → @Cron('*/5 * * * *')  кожні 5 хв, лише якщо FOOTBALL_LIVE_CRON_ENABLED=true
                                 і лише турніри з матчем у LIVE-вікні
вручну                        → POST /api/v1/football/sync  { competitionIds?: [наші slug-и] }
```

**Правила синку (переносити на кожну нову сутність — `Player`, `MatchEvent` тощо):**
- Повний синк турніру — **рівно 4 запити** (competition, teams, matches, standings); сезон фіксується з першого, відповідь про інший сезон → `FAILED`
- **Дельта:** `payloadHash` (SHA-256 нормалізованого `Provider*`) у `*ExternalRef`; без змін — жодного запису в доменну таблицю
- **Власність полів:** синк пише лише provider-owned поля; editorial (`slug`, `type`, `isActive`, `sortOrder`, переклади, прив'язки постів) — **ніколи**; `Club.slug` / `Season.label` — лише при створенні (вони в URL)
- **Без голого `upsert`** для спільних сутностей (Prisma 7 + driver adapter — не атомарний): `createMany skipDuplicates` + дочитування; клуб + ref — одна транзакція, P2002 → відкат і повторний resolve (P2002 вкладеного ref Prisma звітує як `modelName: "Club"`)
- **`Match` не видаляється** (каскад знищив би коментарі й лайки); `likeCount` / `dislikeCount` синк не пише; матчі — чанки по 50 в порядку `matchId`
- Таблиця — атомарно на `(seasonId, stage, groupName, type)` під `Season FOR NO KEY UPDATE`
- **Лок:** `SyncRun` `RUNNING` (partial unique) на provider + scope + турнір, `tryStart` під advisory-локом; застарілий (повний > 10 хв, LIVE > 3 хв) → `FAILED STALE`
- **LIVE:** вікно — гра йде або `SCHEDULED` у `[−3 год, +15 хв]`; LIVE-синк лише оновлює наявні матчі, `FINISHED` → оновити таблицю; не частіше 60 с на турнір

**football-data v4 — перевірено на реальних відповідях (Фаза 5.1):**
- `limit` / `offset` на матчах **ігноруються** — приходять усі матчі сезону одним запитом
- `score.fullTime` **містить** серію пенальті (маппер віднімає); `standings[].group` для ліг — підпис («Matchday», «League phase»), не група
- Standings: EC 2024 → **404** (= «таблиці немає», не збій); WC 2026 — одна таблиця `GROUP_STAGE` на 48 команд, групи — лише в `Match.groupName`; з `?season=` — `TOTAL` + `HOME` + `AWAY`
- `matchday` плей-оф: WC — `null`, EC — 4–7 → тури кубка групуємо за стадією; учасник до жеребкування — `homeTeam.id: null` (матч пропускається)
- Збірні ніяк не позначені — `NATIONAL` за турніром (WC, EC); `minute` — лише в LIVE; дати — UTC (конвертувати на фронті)

**Відоме, свідомо не зроблено (Фаза 5a):**
- Черга запитів до провайдера — на процес: кілька інстансів API ділять квоту ключа → спільний лімітер (етап 14)
- Повний і LIVE-синк одного турніру можуть іти одночасно (різні `scope`): повний може на секунди перезаписати свіжіший LIVE-рахунок — самовиправляється наступним синком
- `live-touch` шлеться раз на відкриття сторінки матчу → на проді увімкнути `FOOTBALL_LIVE_CRON_ENABLED` (етап 14)
- `SyncRun` росте (LIVE — до 60 запусків / год на турнір) → очищення старих запусків (бэклог)

---

#### 4.4 — Schema v5 refactor ✅ (проміжний план `docs/archive/football-plan-intermediate.md`, 2026-09-24 … 2026-09-28)
- [x] Фаза 0 — підготовка, експорт контенту
- [x] Фаза 1 — схема v5 + baseline-міграція + seed, `prisma/sql/constraints.sql`
- [x] Фаза 2 (2a–2f) — identity, refresh-сесії, модерація, видалення акаунта, frontend-сесія, hardening
- [x] Фаза 3 — контент: статуси, мови з БД і fallback, контракт постів
- [x] Фаза 4 — engagement: треди коментарів, soft delete гілкою, purge, лайки
- [x] Рев'ю Фаз 1–4 — гонки коментарів / лайків, мапінг помилок Prisma 7, межа пароля в байтах
- [x] Фаза 5 — Football + Sync на v5 (5a + рев'ю)
- [x] Фаза 5b — перемикач ліг у сайдбарі (+ вигляд кубка в сайдбарі, наскрізна перевірка застосунку)
- [x] Фаза 6 — типи (`packages/types`), документація (`CLAUDE.md`, `README.md`, цей план)
- [x] Фаза 7 — фінальна перевірка: пункти перевірено в межах фаз + наскрізний прогін застосунку в Chrome (59/59); API unit 109/109
- [x] Хвости (2026-09-28): часовий пояс дат (cookie `tz` + `useDateTimeFormat`), soft 404 матчу, мобільний навбар без виходу за екран, ESLint web / API — 0 (`LikeBar`, `auth/guards`, `<img>` → `next/image`), CTA «увійдіть» не блимає після F5; перевірка в Chrome 19/19 (архів, розділ 12.1)
- Squash міграцій — безпосередньо перед релізом → **етап 14**

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
- [x] API: мови з таблиці `Language` (кеш 60 с), fallback на default + `resolvedLanguage`; web — бейдж / банер «Переклад недоступний», правильний атрибут `lang` (Фаза 3)

---

### Етап 5b — Модуль `football`: підмодулі Nest + шар зовнішнього API ✅

**Мета:** один HTTP-домен `FootballModule`, шари `integration` / `persistence` / `query` / `sync` — **детальне дерево файлів і модулів у підрозділі 4.3** (блок «Архітектура модуля»), тут без повторення.

- [x] `FootballIntegrationModule` — `integration/` (порт `FootballProvider` + адаптер `football-data/`: client, mapper, provider).
- [x] `FootballPersistenceModule` — `persistence/` (`FootballRepository`, `FootballSyncRepository`, `ExternalRefRepository`, `SyncRunRepository`).
- [x] `FootballQueryModule` — `query/` (`FootballQueryService`).
- [x] `FootballSyncModule` — `sync/` (`FootballSyncService`, `FootballLiveSyncService`, `FootballLiveThrottleService`, `FootballSyncWriter`, cron).
- [x] `football.module.ts` імпортує query + sync; `football.controller.ts` у корені разом з `dto/`, константами та утилітами.
- [ ] Нові агреговані ендпоінти альфи + кеш TTL — **етап 7.0** (без додаткових кореневих модулів поза `football`).

---

### Етап 6 — Likes система

> ✅ Зроблено ще до проміжного плану; у v5 доведено (Фази 2c, 4, рев'ю).

#### 6.1 — Backend ✅
- [x] `src/likes/like.module.ts`
- [x] `src/likes/like.service.ts` — toggle логіка (та сама дія знімає голос, як на YouTube)
- [x] `src/likes/like.controller.ts`
  - `POST /likes` — toggle like/dislike
  - `GET /likes/stats/:targetType/:targetId` — кількість лайків (дізлайки публічно не показуємо) + `myReaction`
- [x] v5: `UserReactionActivity { targetType, reaction }` на кожну зміну; анти-абуз (burst → `LIKES_SUSPENDED`); пост — лише живий, коментар — лише видимий (не під чернеткою); транзакція спершу блокує рядок цілі (паралельні кліки по черзі, purge → 404)

#### 6.2 — Frontend ✅
- [x] `components/features/LikeBar.tsx` + `hooks/useLikes.ts` (оптимістичне оновлення)
  - Показує кількість лайків (👍 N), дізлайки не показуються публічно
- [x] Підключено до сторінки новини, коментарів і сторінки матчу
- [x] Борг: ESLint error `react-hooks/set-state-in-effect` у `LikeBar.tsx` (з 2e) — стан блокування прив'язаний до цілі, без effect (2026-09-28)
- [ ] Лайки коментарів — пачкою в дереві, а не запит на кожен вузол (🧭 п. 10, етап 8.2)
- [ ] Статистика дізлайків — лише в адмінці (етап 11)

---

### Етап 7 — Футбольні сторінки (web) + **альфа-scope**

Детальна карта маршрутів — у розділі **«Альфа-реліз: карта сторінок»** вище (кроки A–F). **Окремо від етапу 6** (спочатку лайки, потім цей блок).

#### 7.0 — Backend під альфу (паралельно з UI)
- [x] **Передумова:** Фаза 5 проміжного плану — синк v5 (`Season`, `SeasonClub`, `Standing` по групах), запити через поточний сезон (`isCurrent`) з опційним `?season=2025-26`, публічні ендпоінти ліг (розділ 6.4) ✅
- [ ] **Спершу:** e2e-набір `apps/api/test/` на окремій БД + GitHub Actions (lint, typecheck, unit, e2e; ESLint в admin) — 🧭 п. 9
- [ ] Контракт: `packages/types` → `dist`, `toPublic*` у API `satisfies` типів пакета, константи без копій — 🧭 п. 8
- [ ] Агреговані ендпоінти в `football` (hub ліги, список матчів, календар, сторінка клубу) — поверх існуючого repository; усе в межах сезону (`?season=`), як `FootballQueryService`. Новини ліги / клубу — **не тут**, а `GET /posts?competition=&club=` (🧭 п. 1)
- [ ] Матчі клубу — через `homeClubId` / `awayClubId` + сезон (індекси `[homeClubId, kickoffAt]` / `[awayClubId, kickoffAt]` є), наскрізно за турнірами (PL + CL + кубок); «сезон» клубу = `Season.label` у всіх його турнірах (🧭 п. 2)
- [x] Календар / матчі за датою: `GET /football/matches?from=&to=&league=PL,CL` (2026-09-28) — ISO з поясом, `[from, to)`, ≤ 32 доби (31 + запас на перехід часу) → 400 `MATCH_RANGE_INVALID` / `MATCH_RANGE_TOO_LONG`; без `league` — лише активні турніри, зі slug-ами — будь-які; ≤ 1000 рядків; відповідь `{ matches: [рядок + league] }`, за `kickoffAt`. Межі дня рахує web у поясі користувача (🧭 п. 3). Кешу ще немає (🧭 п. 4)
- [ ] Список сезонів турніру для перемикача архіву (🧭 п. 5)
- [ ] Межі кожного нового query-параметра (🧭 п. 6)
- [ ] In-memory кеш read-only з TTL 60–300 с: у `FootballQueryService`, single-flight, ліміт розміру, ключі з тегом турніру; інвалідація по завершенню `SyncRun` (повного й LIVE) **лише свого турніру**; спершу виміряти p95 (🧭 п. 4)
- [ ] Розширення API альфи в межах існуючих підмодулів `football` (**етап 5b** вже застосовано)

#### 7.1 — Ліги
- [ ] `/[locale]/leagues/page.tsx` — список ліг (актуально при >1 змаганні)
- [ ] `/[locale]/leagues/[leagueSlug]/page.tsx` — hub ліги
- [ ] `.../standings/page.tsx` — повна таблиця; вкладки «Загальна / Вдома / На виїзді» — дані вже є (з `?season=` провайдер дає `TOTAL` + `HOME` + `AWAY`)
- [ ] `.../matches/page.tsx` — матчі ліги (тури)
- [ ] `.../clubs/page.tsx` — клуби ліги
- [x] Таблиця + тури на **головній** (сайдбар) — вже є; після hub — лінки
- [ ] Маршрути з урахуванням сезону: `/leagues/[slug]?season=2025-26` (без параметра — поточний)
- [ ] Вигляд сторінки за `Competition.type`: LEAGUE → таблиця + тури, CUP → групи / ліга-фаза + сітка плей-оф
- [ ] Групові таблиці ЧС з `Match.groupName` + перемикач груп (P5b-7): провайдер дає одну таблицю `GROUP_STAGE` на 48 без груп. ⚠️ Місце в групі **не виводити** з порядку загальної таблиці — при рівності очок регламент (особисті зустрічі) може дати інший порядок; або рахувати за регламентом турніру з тестами, або показувати групу без номерів місць
- [ ] Сітка плей-оф: стадії з `Match.stage` (`matchday` плей-оф — `null` у WC, 4–7 в EC), двоматчеві раунди — пара матчів з сумою, пенальті окремо; учасник ще не визначений → матчу в БД немає (синк пропускає TBD) — сітка має показувати порожній слот, а не падати. **Спершу рішення про TBD-матчі** (nullable клуби + синк) і «колонки стадій замість дерева» — 🧭 п. 7
- [x] Перемикач ліг у сайдбарі (`?league=`, групи «Ліги» / «Кубки») — **Фаза 5b проміжного плану** ✅
- [ ] SSR невідомої ліги (`?league=NOPE`) — зараз «Завантаження…» в HTML, повідомлення «не знайдено» лише після гідрації (помилку prefetch не гідруємо)
- [ ] Навбар «Ліги» / «Клуби» веде на 404, доки немає сторінок 7.1 / 7.2 (у посиланнях `prefetch={false}` — прибрати разом із появою сторінок). ✅ 2026-09-28: 404 більше не «ламається» — раніше кореневий `not-found` рендерився без `<html>` / `<body>` (у dev — червоний Runtime Error «Missing <html> and <body> tags», у проді — неоформлена англійська сторінка; те саме для невідомої новини / матчу). Тепер — одна загальна перекладена 404 (`app/not-found.tsx`, Rule 8 фронту); самі сторінки — цей етап
- [ ] Мобільне меню (бургер) — у тому ж PR, що й перші сторінки ліг: на < 768 px посилань «Ліги / Клуби» в навбарі немає, ім'я й адмінку сховано (🧭 п. 15)
- [ ] Новини ліги / клубу — через `PostCompetition` / `PostClub` (зв'язки вже пишуться з адмінки: `competitionIds` / `clubIds`; деталь поста віддає `competitions` / `clubs`) — endpoint у posts, prefetch паралельно з football (🧭 п. 1)
- [ ] Кожна сторінка з slug у URL — `fetchQuery` + `notFound()` на 404, metadata і сторінка — через одну `cache()`-функцію (Rule 8 фронту)
- [ ] Назви турнірів / країн — англійською з провайдера; переклад — `CompetitionTranslation` / `ClubTranslation` (Частина 2, «Спроєктовано, але ще не створено»), коли знадобиться

#### 7.2 — Клуби (teams у generic naming)
- [ ] `/[locale]/clubs/page.tsx` — опційно
- [ ] `/[locale]/clubs/[clubSlug]/page.tsx` — картка клубу (`Club.slug` стабільний: `slugify(name)` з транслітерацією, при колізії `-<країна>` / `-2`; синк його не змінює). Клуб, відомий лише з матчу / таблиці, має неповні дані (без `founded`, `venueName`…) — UI без цих полів не має ламатись
- [ ] `/[locale]/clubs/[clubSlug]/matches/page.tsx` — матчі клубу наскрізно за турнірами, `?season=2025-26` = label у всіх турнірах клубу, `?competition=` — фільтр (🧭 п. 2)

#### 7.3 — Матчі та календар
- [x] `/[locale]/matches/page.tsx` — матчі дня (2026-09-28): `?date=YYYY-MM-DD` у поясі користувача (без нього — сьогодні), межі дня → `from` / `to` (`lib/i18n/zoned-date.ts`, перевірено на переходах часу й 400 днях у 4 поясах); групи за турнірами в порядку перемикача зі спільним туром («Тур 6», «Ліга-фаза · Тур 2»); фільтр `?league=` (чипи, на телефоні — прокрутка); попередній / наступний день, «Перейти на сьогодні»; матчі в грі — `refetchInterval` 60 с, **без** `live-touch` (квота; на проді — LIVE-cron); до 640 px — команди одна під одною. Пункт «Матчі» в навбарі. Невалідні `date` / `league` → сьогодні / усі
- [x] Сторінка матчу: назва у вкладці «Господарі – Гості · Ліга» (`generateMetadata` + `cache()` — один запит), посилання «Усі матчі {дата}» → `/matches?date=` дня матчу в поясі користувача; тур — спільний `roundLabel` (`useFootballStageLabels`)
- [ ] Вибір дати календарем (зараз — лише ‹ / ›) — разом із `/calendar`
- [x] `/[locale]/matches/[id]/page.tsx` — деталь (коментарі на матчі — **етап 8**; лайки — **етап 6**)
- [x] Невідомий `id` матчу → HTTP 404 (`fetchQuery` + `notFound()`, як у новини; 2026-09-28)
- [ ] `/[locale]/calendar/page.tsx` — календар (інтервал дат в UTC від web, групування за днем у поясі next-intl — 🧭 п. 3)

#### 7.4 — Гравці / склад (поза мінімальною альфою, якщо немає Player у БД)
- [ ] Рішення: міграція `Player` + синк **або** відкласти після v1 альфи (модель спроєктовано: `Player`, `PlayerExternalRef`, `SquadMember { seasonId, clubId, playerId, shirtNumber, position }` — Частина 2, «Спроєктовано, але ще не створено»)
- [ ] Перед проєктуванням синку — перевірити на **реальних** відповіді й тарифі (як у Фазі 5.1), чи є склад у `/competitions/{id}/teams` (тоді 0 нових запитів) чи потрібен запит на кожен клуб (у dev-БД ~190 клубів × 6,5 с ≈ 20 хв черги — окремий розклад, не в 2-годинному повному синку). Правила синку 4.3 (дельта, editorial-поля, без голого `upsert`, `PlayerExternalRef`) — ті самі
- [ ] `/[locale]/clubs/[clubSlug]/squad/page.tsx`
- [ ] `/[locale]/players/[playerId]/page.tsx`

#### 7.5 — Live / transfers (не альфа)
- [ ] Окремий етап: live-стрім даних (інший API / SSE) — поза поточним football-data free tier
- [ ] Transfers — лише за наявності джерела даних

---

### Етап 8 — Comments розширення (replies, матчі, YouTube-глибина)

#### 8.1 — Backend ✅ (v5, Фаза 4 проміжного плану)
- [x] `CreateCommentDto` — рівно одна ціль (`postId` | `matchId`), `parentId?`
- [x] `CommentThread` — одна гілка на пост / матч, створюється з першим коментарем; `rootId` / `depth` зберігаються (відповіді до глибини 15), лічильники `commentCount` / `replyCount` у тій самій транзакції
- [x] Коментувати й читати можна лише живий пост (чернетка → 404); `GET /comments/match/:matchId` і `POST` з `matchId` — API коментарів матчу готовий
- [x] `DELETE /comments/:id` — soft delete разом з гілкою відповідей; ADMIN purge / purge-thread (фізично, legal / GDPR)
- [x] `isLocked` треду → 403 `COMMENT_THREAD_LOCKED` (ендпоінту блокування ще немає — етап 11)
- [x] Відповідь на будь-який коментар (вкладене дерево) — замість старого «один рівень вкладеності»
- [ ] Відображення «як в YouTube»: вирішити, чи сплющувати глибокі відповіді (YouTube — один рівень + `@згадка`), чи лишити дерево — **до** пагінації, бо від цього залежить її модель (🧭 п. 10)
- [ ] Пагінація дерева (зараз `GET` віддає весь тред; ріст обмежений cooldown-ом коментарів) — для матчів одразу: корені сторінками за `(createdAt, id)`, відповіді гілки за `rootId` (індекс `[rootId, createdAt]` є)
- [ ] Дерево віддає `likeCount` + `myReaction` (пачкою для залогіненого) — замість запиту `GET /likes/stats/comment/:id` на кожен вузол (🧭 п. 10)
- [ ] Pin / lock / unlock — ендпоінти для адмінки (етап 11)

#### 8.2 — Frontend
- [x] `CommentSection.tsx` / `CommentThreadNode.tsx` — дерево відповідей для **поста**, «Відповісти» на кожному вузлі, підтвердження видалення з кількістю відповідей
- [ ] Те саме UX на **сторінці матчу** — API готовий; `CommentSection` / `useComments` зараз прив'язані до поста → винести в `components/comments/` з ціллю `{ type: 'post' | 'match', id }`, ключ `['comments', type, id]` (🧭 п. 10)

---

### Етап 9 — Теги і категорії

#### 9.1 — Backend
- [ ] `src/tags/tag.module.ts`
- [ ] CRUD тегів (тільки ADMIN створює) — з `TagTranslation` (D17)
- [ ] `GET /tags` — список всіх тегів
- [ ] `GET /posts?tag=premier-league` — пости по тегу
- [x] `CreatePostDto` / `UpdatePostDto` — `tagIds?: string[]` (≤ 20, існування перевіряється → 400 `UNKNOWN_TAG`; Фаза 3)
- [x] Теги в публічній відповіді поста — назва мовою запиту → default → `slug` (Фаза 3)

#### 9.2 — Frontend
- [ ] Теги на картці поста і сторінці новини
- [ ] `/posts/page.tsx` — всі пости з фільтром по тегах
- [ ] Sidebar або горизонтальний список тегів

---

### Етап 10 — Профіль користувача

#### 10.1 — Backend
- [ ] `src/users/user.controller.ts` (зараз є `users/management/user.controller.ts` — лише видалення)
  - `GET /users/:id` — публічний профіль (`UserProfile`: `displayName`, `avatarUrl`, `bio`; видалений → «Deleted user»)
  - `GET /users/:id/comments` — коментарі юзера (для авторизованих)
  - `PUT /users/me` — редагування свого профілю (пише в `UserProfile`, не в `User`)
- [x] `DELETE /users/me` — видалення свого акаунта з підтвердженням паролем: анонімізація, сесії видаляються, пошта заблокована на 30 днів (Фаза 2d)
- [x] `src/users/user.repository.ts` (identity + профіль)
- [ ] `UserFavoriteClub` — улюблений клуб (спроєктовано — Частина 2, «Спроєктовано, але ще не створено»)

#### 10.2 — Frontend
- [ ] `/profile/[id]/page.tsx`
  - Аватар, ім'я, bio
  - Список коментарів юзера (для авторизованих)
- [ ] `/profile/me/page.tsx` — свій профіль з формою редагування
- [ ] «Видалити акаунт» — підтвердження паролем (API готовий; `apiDelete(url, body)` уже вміє тіло; 403 `INVALID_PASSWORD` — помилка форми)

---

### Етап 11 — Адмінка (розширення)

- [ ] Редагування постів і зміна статусу (Draft / Scheduled / Published / Archived) — API `PUT /posts/:id` готовий (Фаза 3); редагування slug чернетки
- [ ] Пагінація `GET /posts/admin/all`
- [ ] Управління тегами (CRUD)
- [x] Ручний тригер sync (`POST /football/sync`) — кнопка на дашборді
- [x] Журнал `SyncRun` на дашборді (Фаза 5a проміжного плану; автооновлення, поки є `RUNNING`)
- [ ] Керування турнірами: `Competition.isActive` (синк за cron-ом + видимість у перемикачі; вимкнена ліга лишається доступною за slug — архів), `sortOrder`; додати турнір = рядок + `CompetitionExternalRef`
- [ ] Статистика лайків і дізлайків (тільки адмін бачить дізлайки)
- [ ] Модерація коментарів: soft delete (API ✅), **purge / purge-thread** (API ✅ — з окремим підтвердженням, не плутати з «Delete»), lock / unlock треду, pin
- [ ] Користувачі: видалення акаунта (`DELETE /users/:id` — API ✅, пише `UserSanction(ACCOUNT_DELETED)`), ручні санкції, розблокування (див. бэклог безпеки)
- [ ] Список AI-парсингу новин (чернетки з `sourceUrl`)

---

### Етап 12 — Адаптивність (Mobile)

- [x] Навбар не виходить за екран на 320…1280 px (2026-09-28): до 640 px — лише ⚽ і «Увійти» (реєстрація — зі сторінки входу), до 1024 px — коди мов `EN` / `UA`, ім'я користувача — від 1024 px (обрізане), адмінка — від 640 px
- [ ] Мобільне меню (burger) з посиланнями «Новини / Ліги / Клуби», ім'ям і адмінкою — **перенесено в 7.1** (🧭 п. 15)
- [ ] Адаптивна сітка постів
- [ ] Адаптивна таблиця ліги (горизонтальний скрол або спрощена)
- [ ] Тестування: 320px, 375px, 768px, 1024px, 1440px

---

### Етап 13 — SEO

- [ ] `generateMetadata` для всіх сторінок (враховувати мову)
- [ ] `hreflang` лише для мов, де є переклад (API вже віддає `availableLanguages`), `canonical` на EN-версію; потрібен `metadataBase` (абсолютний URL сайту)
- [x] Title сторінки 404 для неіснуючого поста — «Сторінку не знайдено» (було «Не вдалося завантажити пост»; 2026-09-28). Матч без `generateMetadata` — title layout-у
- [ ] SSR-HTML 404 від кинутого `notFound()` (невідома новина / матч) — порожня оболонка Next (`__next_error__`), контент малює клієнт; статус 404 + `noindex` є. Невідомі URL уже з повним SSR (`/_not-found`, з 2026-09-28 — одна загальна 404). Для `notFound()` сторінок обійти поведінку фреймворку не вийде
- [ ] OpenGraph теги (title, description, image)
- [ ] `sitemap.ts` — динамічний sitemap
- [ ] JSON-LD structured data для матчів і статей

---

### Етап 13.5 — Бета: підтвердження пошти (обов'язково перед продакшеном)

> Навіщо: зараз `register` відповідає `409 Email already in use` / `403 EMAIL_BLOCKED` — за цим можна перевірити, чи зареєстрована адреса (enumeration). Плюс без підтвердження можна реєструватися на чужу пошту. Та сама інфраструктура дає «забули пароль».

**Потік:**
- [ ] `User.emailVerifiedAt` (nullable) + таблиця `EmailVerificationToken` (`userId`, `tokenHash` — SHA-256 випадкового токена, `expiresAt` ~24 год, `usedAt`) — адитивна міграція
- [ ] Реєстрація: створити юзера з `emailVerifiedAt = null` → лист з посиланням → клік → `POST /auth/verify-email` ставить `emailVerifiedAt`
- [ ] `register` **завжди** відповідає однаково («перевірте пошту»): якщо адреса вже зайнята — власнику лист «хтось пробував зареєструватися, увійдіть або відновіть пароль»; заблокована — без листа. Закриває enumeration
- [ ] Повторне надсилання листа — з лімітом (throttler, як у «Лімітах спроб»)
- [ ] Вирішити, що може непідтверджений користувач (напр. читати — так, коментувати / лайкати — ні)
- [ ] «Забули пароль»: той самий механізм токенів + відкликати всі `AuthSession` після зміни пароля

**Сервіси:**
- Сервіс транзакційної пошти (свій SMTP-сервер — листи в спам): **Resend** (зручний для Node), **Brevo**, **Postmark** — є безкоштовні рівні для старту; **Amazon SES** — найдешевший на обсягах. Ціни й ліміти перевірити перед підключенням
- Свій **домен** + DNS-записи **SPF, DKIM, DMARC** (безкоштовно, налаштовується в DNS)
- Dev: **Mailpit** — локальна «скринька», листи нікуди не йдуть (безкоштовно)

---

### Етап 14 — Деплой + CI/CD

- [ ] GitHub Actions: lint + build при PR (базовий CI — ще на старті 7.0, 🧭 п. 9; тут — деплой)
- [ ] **Спершу — домени (🧭 п. 11):** web, API й admin на одному зареєстрованому домені (`example.com` / `api.` / `admin.`) **або** API через rewrites Next — інакше cookies `SameSite=Lax` між `*.vercel.app` і `*.railway.app` не ходять і логін не працює
- [ ] Vercel для web + admin
- [ ] Railway для api — **1 репліка**, поки throttler / черга провайдера / кеш / cron у пам'яті процесу (🧭 п. 12)
- [ ] Environment variables в продакшні: `JWT_SECRET`, `EMAIL_HASH_SECRET` (≥ 32, випадкові; `EMAIL_HASH_SECRET` не змінювати після запуску), `CORS_ORIGINS` (https), `TRUST_PROXY` (кількість проксі), `NODE_ENV=production` (secure cookies); прибрати `JWT_REFRESH_SECRET` (локально — теж: `apps/api/.env`, разом з `FOOTBALL_COMPETITION_IDS`)
- [ ] `.env.example` для api / web / admin (лише ключі, без значень) — у репо їх немає, `.gitignore` уже пускає `!.env.example`
- [ ] CORS оновити на продакшн домени
- [ ] Спостережуваність (🧭 п. 13): Sentry (web / admin / API), `GET /health` (DB ping) для Railway, алерт на `SyncRun FAILED` N разів поспіль
- [ ] Очищення старих `SyncRun` (з LIVE-cron — тисячі рядків на день у матчдей), напр. у `SecurityCleanupCron` або окремому cron-і — перенесено з «бэклогу безпеки»: від Redis не залежить
- [ ] Міграції: останній squash перед релізом (Частина 2) → прод з `0001_init`; `pg_dump` перед кожним `migrate deploy`
- [ ] Кілька інстансів API → Redis-сховище для throttler (зараз пам'ять процесу) і спільний лімітер запитів до football-data (зараз черга на процес — інстанси ділять квоту ключа)
- [x] **Часовий пояс дат** (2026-09-28): пояс — у конфігу next-intl (cookie `tz` від `TimeZoneSync`, інакше `Europe/Kyiv`), дати — `useDateTimeFormat` / `formatDateTime`; перевірено з web-сервером у `TZ=UTC` і браузером у Києві / Нью-Йорку — без hydration mismatch. На Vercel — розглянути `x-vercel-ip-timezone` як fallback без cookie (🧭 п. 14)
- [ ] ⚠️ **Транзакційний пулер Supabase (`:6543`)** рве з'єднання: запит на «мертвому» сокеті висить ~12–15 хв (відтворено без нашого коду). `PrismaPg` з `keepAlive`, `connectionTimeoutMillis`, клієнтським `query_timeout`; перевірити на проді. Зависання > 10 хв дає стартувати другому синку того ж турніру (дані ідемпотентні, у гіршому разі `PARTIAL`)
- [ ] `FOOTBALL_LIVE_CRON_ENABLED=true` на проді (інакше LIVE оновлюється лише від `live-touch` глядачів)

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
- [ ] Можливість скаржитись на коментар (report) — таблиця `ContentReport { reporterId, commentId, reason, status }` (спроєктовано — Частина 2)
- [ ] В адмінці: список скарг + швидке видалення (soft delete і purge у API вже є)

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

### 🔐 Бэклог безпеки — робити разом з Redis (не зараз)
> Додано після рев'ю Фаз 1–2 і 2f (`docs/archive/football-plan-intermediate.md`). Поточний стан: throttler у пам'яті процесу, strikes анти-абузу — `UserSanction` за весь час, `sid` перевіряється запитом до `AuthSession`.

- [ ] **Anti-abuse на Redis:** sliding-window лічильник порушень (ZSET `abuse:<userId>:<action>`, score = timestamp, `ZREMRANGEBYSCORE` + `ZCARD`) замість strikes «за весь час»; `@nestjs/throttler` → Redis-сховище (ліміти спільні для всіх інстансів, переживають рестарт)
- [ ] **`POST /users/:id/unlock` (ADMIN):** ідемпотентний (уже ACTIVE → 200 без змін), аудит — `UserSanction.revokedAt` + запис «хто / коли / чому»; кнопка в адмінці користувачів (Етап 11)
- [ ] **Прогресивний бан** замість одразу permanent: 1 хв → 10 хв → 1 год → 1 день → permanent (рівень — з кількості порушень у sliding window); permanent — лише після ручного рішення або вичерпання рівнів
- [ ] **Email confirmation + anti-enumeration:** однакова відповідь `register` незалежно від зайнятості / блоку адреси — див. **Етап 13.5**
- [ ] **Session store для `sid` у Redis:** множина активних сесій користувача (instant revoke без запиту до БД на кожен запит; список «мої пристрої»); `AuthSession` у БД лишається джерелом правди для refresh / reuse-detection
- [ ] **CSRF для мутацій** (defence in depth поверх `SameSite=Lax` — див. Частину 1) — до публічного проду
- [ ] **Cooldown коментарів не атомарний** (з 2c): N паралельних коментарів проходять перевірку разом (до `burstThreshold − 1`); за потреби — `assert` + `record` під одним advisory lock
- [x] **`POST /football/live-touch`** — публічний POST, що може витрачати квоту провайдера → 10 / хв на IP + інтервал 60 с на турнір через `SyncRun` (Фаза 5a)
- [ ] ~~Очищення старих `SyncRun`~~ → етап 14 (від Redis не залежить)
- [ ] `GET /auth/me` для гостя: зараз кожне повне завантаження — `me` 401 → `refresh` 401 (2 запити + шум у консолі). Refresh-cookie має `path=/api/v1/auth`, тож `/auth/me` її бачить: немає ні access-, ні refresh-cookie → `200 { user: null }` без циклу refresh (контракт `authMeQueryOptions` — разом)
- [ ] Лайк оновлює `updatedAt` поста / коментаря (Prisma `@updatedAt` на лічильнику) — не брати `updatedAt` для `lastmod` у sitemap без окремого поля

### Тести
- [x] Jest unit тести чистої логіки (API) — **118** (переходи статусу поста, slug, `LanguageService`, дерево / піддерево коментарів, `prisma-errors`, `MaxUtf8Bytes`; football — маппер на реальних зразках провайдера, черга клієнта з 429, `payloadHash`, slug клубу, LIVE-вікно, тури за стадіями, головна таблиця / дашборд, інтервал `GET /football/matches`)
- [ ] Web — тест-раннера немає: `lib/i18n/zoned-date.ts` (межі дня в поясі) перевірено тимчасовим `node --test` (7 тестів, переходи часу, 400 днів × 4 пояси) — перенести в постійні тести разом із CI (🧭 п. 9)
- [ ] Integration тести для API endpoints — у Фазах 2–5 були **тимчасові** скрипти (Nest на dev-БД, фейковий провайдер з «воротами» для детермінованих гонок, справжні HTTP-запити з cookies; сотні перевірок, 5a — 168) і видалялись після прогону → перенести в `apps/api/test/` як e2e-набір на окремій БД. Довгі прогони — через `DIRECT_URL` (session-пулер), не транзакційний. **Пріоритет піднято: на старті 7.0** (🧭 п. 9); окрема БД — локальний Postgres (docker-compose лише для БД — раніше за повний «Docker» нижче)
- [ ] E2E тести (Playwright) — сценарії вже є з ручних прогонів у Chrome (5b: перемикач 49, застосунок 59): реєстрація → коментар → refresh-on-401 → лайк → вихід; адмінка — пости, синк; перемикач ліг

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
- **4.3 + 5b — Football API (v5):** порт провайдера + адаптер football-data, `*ExternalRef`, сезони, `SyncRun` (журнал + лок), дельта-синк (4 запити на турнір), LIVE-вікно + `live-touch`; підмодулі `integration` / `persistence` / `query` / `sync` (деталі — **Етап 4.3**).
- **4.3b — Football UI (мінімум):** сайдбар на головній (SSR, перемикач ліг `?league=`, кубки), `/[locale]/matches/[id]`, sync-кнопка + журнал синків в адмінці.
- **5 — i18n:** next-intl, `app/[locale]/...`, локалі **`en` | `ua`**; у `proxy` нормалізація Accept-Language (**`uk*` → `ua`**) для next-intl; для `Intl` — `uk-UA` у `content-lang.ts`.
- **5b — Football структура:** підмодулі `FootballIntegrationModule`, `FootballPersistenceModule`, `FootballQueryModule`, `FootballSyncModule` (див. етап 5b у плані).
- **4.4 — Schema v5 ✅ (проміжний план, Фази 0–7, 2026-09-27; архів — `docs/archive/`):** схема v5 і baseline-міграція; auth на refresh-сесіях, модерація, видалення акаунта; пости зі статусами й fallback перекладів; треди коментарів, purge; межа пароля в байтах; football / sync на v5; перемикач ліг. Перевірка — 109 unit, наскрізний прогін застосунку 59/59.
- **Хвости v5 ✅ (2026-09-28):** часовий пояс дат (cookie `tz` + `useDateTimeFormat`, без hydration mismatch), soft 404 матчу → 404, навбар без виходу за екран 320…1280 px, ESLint web / API — 0; Chrome 19/19.
- **6 — Лайки:** API + `LikeBar` на новині, коментарях і матчі; у v5 — журнал реакцій, анти-абуз, блокування цілі.

### У роботі / наступні за планом v4.7

1. **7.0, старт:** e2e-набір на окремій БД + CI (🧭 п. 9), контракт типів API ↔ web (🧭 п. 8).
2. **7** — альфа football UI (`leagues/*`, `clubs/*`, `calendar`; `matches` — ✅ матчі дня) + агреговані ендпоінти + кеш TTL; групові таблиці ЧС і сітка плей-оф (спершу рішення про TBD-матчі, 🧭 п. 7); бургер-меню — з першими сторінками ліг (🧭 п. 15).
3. **8.2** — коментарі на сторінці матчу (API готовий; спільний компонент, лайки пачкою, пагінація — 🧭 п. 10).
4. Далі **9+** за нумерацією в плані; перед публічним продом — CSRF, підтвердження пошти (13.5), домени / cookies (🧭 п. 11), спостережуваність (🧭 п. 13), squash міграцій (14).
5. Вручну (власник): прибрати з локального `apps/api/.env` рядки `JWT_REFRESH_SECRET` і `FOOTBALL_COMPETITION_IDS` — код їх не читає.

### Патерн даних (нагадування)

```
TanStack Query → клієнтський кеш, мутації, prefetch/dehydrate
Zustand        → user після логіну (web/admin)
lib/api/http.ts → єдиний fetch + credentials
```

**Зроблено (Фаза 2e):** `GET /auth/me` + `useAuthQuery` — сесія після F5; refresh-on-401 у `http.ts` (web і admin — міняти разом).

---

## 🤖 Контекст для AI (вставляти на початку нової сесії)

**Проект:** Футбольний портал (новини з i18n, матчі, клуби, ліги, профілі, теги, лайки, replies).
**Стек:**
- Web: Next.js 16 + React 19 + Tailwind 4 + React Hook Form + Zod + Zustand + TanStack Query + **next-intl** (`app/[locale]/...`, порт 3000)
- Admin: Next.js 16 + TanStack Query (порт 3001)
- API: NestJS 11 + Prisma 7 + PostgreSQL (порт 4000)
- Monorepo: pnpm + Turborepo

**БД:** PostgreSQL (Supabase). Prisma **schema v5** (домени identity / moderation / content / engagement / football / sync — Частина 2); ручні обмеження — `prisma/sql/constraints.sql`. Увесь код на v5.
**Ліги:** Football-Data.org v4 через порт `FootballProvider`; наша БД — джерело правди: `*ExternalRef` (дельта за `payloadHash`), `Season` (`isCurrent`), `SeasonClub`, `SyncRun` (журнал + лок); 9 турнірів (6 ліг, CL, WC, EC), cron кожні 2 год, LIVE — `live-touch` / опційний cron. Правила синку — етап 4.3.
**Auth:** access-JWT 15 хв (`sid`) + opaque refresh-сесії в БД (ротація, reuse detection), **httpOnly** cookies (`sameSite: lax`), ролі ADMIN/USER; адмінка — `POST /auth/login/admin`.
**Безпека:** class-validator (межі — `packages/validation`), Helmet, суворий CORS, throttler (IP + акаунт), анти-абуз коментарів / лайків — є; **CSRF і підтвердження пошти — до публічного проду**.
**Архітектура:** Controller → Service → Repository → Prisma; відповіді — `toPublic*` у `*-response.ts`; football: підмодулі + mapper/client у `integration/`; soft delete Post/Comment (+ ADMIN purge коментаря); гонки — правило 10 Частини 1. Web: дати — лише `useDateTimeFormat` / `formatDateTime` (пояс з next-intl, cookie `tz`); сторінка з slug — `fetchQuery` + `notFound()`. Рішення для етапів 7+ — розділ «🧭 Рішення перед етапом 7».

**Що вже зроблено:** auth v5 (сесії, видалення акаунта, модерація), posts + i18n (статуси, `lang` = `en`|`ua` з fallback), коментарі-треди з відповідями (новини; API матчів готовий), лайки, football API (v5) + сайдбар з перемикачем ліг і кубками + `/matches/[id]`, admin (пости зі статусами, sync + журнал синків), next-intl + нормалізація Accept-Language `uk*`→`ua` у proxy.

**Альфа (див. план):** football UI — `leagues/*`, `clubs/*`, `matches` (список), `calendar`; бек — агреговані ендпоінти + кеш TTL; гравці/squad — коли з’явиться модель `Player` або окрема версія.

**Наступні кроки (порядок):** проміжний план ✅ (Фази 0–7 + хвости, архів `docs/archive/`); **7** (старт — e2e + CI, контракт типів; далі альфа UI + API) → **8** (коментарі на матчі). Далі теги (9), профіль (10), адмінка (11+). Перед публічним продом: CSRF, **підтвердження пошти (Етап 13.5, бета)**, домени / cookies, спостережуваність і пулер Supabase (етап 14); Helmet і throttler — ✅ Фаза 2d (`refactor/schema-v5`).

---