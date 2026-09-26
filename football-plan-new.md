# ⚽ Football Portal — Master Plan & Rules

> **Версія плану:** 4.5 (схема БД v5; локалі лише `en`/`ua`; Accept-Language ISO `uk*` → `ua` у proxy; football — підмодулі Nest)
> **Автор:** Олексій
> **Останнє оновлення:** 26 вересня 2026 — частково актуалізовано після Фаз 0–4 проміжного плану `football-plan-intermediate.md` (schema v5) і рев'ю Фаз 1–4
> **Зараз:** проміжний план, **Фаза 5 (Football + Sync)**; після нього — етап 7 цього плану

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
// next-intl middleware визначає мову
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

# ЧАСТИНА 2 — СХЕМА БД (v5)

> **Джерело правди — код:** `apps/api/prisma/schema.prisma` + ручні обмеження `apps/api/prisma/sql/constraints.sql` (CHECK і часткові унікальні індекси, яких Prisma не виражає). Схему тут **не дублюємо**: копія v4 у цьому файлі застаріла, щойно змінився код.
> **Звідки v5:** проміжний план `football-plan-intermediate.md` (розділи 2–5, 9). Схему застосовано у Фазі 1 (2026-09-26); код доменів переведено у Фазах 2–4; FOOTBALL / SYNC — Фаза 5.

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
| Football, Sync | ◻ Фаза 5 — схема є, код `football/` ще під v4 і **не компілюється** |

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

Повні формулювання — розділ 2 проміжного плану. **Спроєктовано, але ще не створено** (адитивно, коли знадобиться): `Player` / `SquadMember` (етап 7.4), `MatchEvent` (15), `ClubTranslation`, `ContentReport` (16), `UserFavoriteClub` (10), `MatchPrediction`, `AuthAccount` (OAuth) тощо — розділ 9 проміжного плану.

---

## 📌 Prisma та міграції — **рішення на зараз** (узгоджено)

- **`LikeType`:** залишаємо **`enum LikeType { LIKE DISLIKE }`**, **без** переходу на `String` + CHECK, доки немає реальної потреби.
- **Атомарність:** створення / оновлення поста — одна nested-операція (поля + переклади + зв'язки); багатокрокові зміни з лічильниками — `$transaction` за правилом 10 Частини 1.
- **Інваріанти, яких Prisma не виражає**, — у `prisma/sql/constraints.sql`: рівно одна ціль треду, різні клуби матчу, опублікований / запланований пост має дату, одна default-мова, один поточний сезон турніру, один `RUNNING` синк на ціль, формат анонімізованих email.
- **Squash до релізу** (розділ 11 проміжного плану): поки немає прод-БД, історію міграцій схлопуємо — `migrate reset` → `migrate dev --name init --create-only` → **дописати `constraints.sql` у baseline** → `migrate dev` → `db seed`. Останній squash — безпосередньо перед релізом (етап 14): прод стартує з однієї `0001_init`. Зараз міграцій чотири: `0001_init` … `0004_auth_session_absolute_lifetime`.
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
| `Competition` / `Team` / `Standing` | З v5 назви майже збігаються: **`Competition`** (`type: LEAGUE \| CUP`), **`Season`**, **`SeasonClub`**, **`Club`**, **`Standing`**. Публічні роути лишаються `football/leagues/:slug/…` (`?season=`), нові ендпоінти — розділ 6.4 проміжного плану (Фаза 5) |
| `teamId` у шляху | Краще **`[clubSlug]`** (є `Club.slug`); внутрішній `id` — для API за потреби |
| Окремі Nest-модулі `competitions`, `teams`, … | **Один** кореневий `FootballModule` + **внутрішні підмодулі**: `FootballIntegrationModule` (зовнішнє API), `FootballPersistenceModule`, `FootballQueryModule`, `FootballSyncModule` — див. **етап 5b** та дерево в **актуалізації**. |
| Модель `Player` у схемі | **Поки немає** в Prisma; спроєктовано `Player` / `SquadMember` (розділ 9 проміжного плану) — сторінки **squad** / **players** після окремої міграції + синку |
| Крок «додати i18n» | **Вже зроблено** (next-intl, `app/[locale]`) — у плані альфи не повторювати |

### Глобальні вимоги альфи

- **i18n:** усі нові екрани — ключі перекладів, маршрути тільки під `[locale]`.
- **Зовнішній API:** виклики **лише** з Nest (`football-data.client`); фронт — **тільки** `NEXT_PUBLIC_API_URL` / `lib/api/http.ts`.
- **Ліміти football-data.org:** кеш на бекенді (in-memory, TTL **60–300 с**) для агрегованих read-ендпоінтів; не дублювати запити з кожного клієнта. Redis — коли буде кілька інстансів API.
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
  page.tsx                  ◻ загальний список матчів (дата / ліга)
  [id]/page.tsx             ✅ деталь матчу
calendar/
  page.tsx                  ◻ календар по матчах з БД
```

### Порядок імплементації (щоб не змішувати шари)

| Крок | Backend | Frontend |
|------|---------|----------|
| **A** | Передумова — **Фаза 5 проміжного плану** (синк v5, поточний сезон `isCurrent`, ендпоінти 6.4). Далі розширити **football** (**етап 7.0**): агреговані ендпоінти + **кеш TTL** на read | — |
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
> **Порядок робіт (не змішувати):** спершу **проміжний план `football-plan-intermediate.md`** — Фаза **5** (Football + Sync на v5) → **5b** (перемикач ліг у сайдбарі) → **6** (типи, документація) → **7** (фінальна перевірка); потім цей план — **7** (альфа football UI + агрегація API) → **8** (коментарі на матчі) → **9+** за номерами. Етап **6** (лайки) — ✅.

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

#### 4.3 — Football Module (NestJS) ✅ backend (+ шаруватість)
> ⚠️ **Опис нижче — стан v4.** Під схемою v5 код `football/` не компілюється (25 помилок `tsc`: `League`, `externalId`, `Club.leagueId`, `Match.date`, `LeagueTable`) — переписується у **Фазі 5 проміжного плану**: порт провайдера + адаптер football-data, `*ExternalRef`, `SyncRun` (журнал і лок), `Season` з `isCurrent`, турніри з `Competition.isActive`. Приклади з `externalId` / `upsert` нижче після Фази 5 застаріють.

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

#### 4.4 — Schema v5 refactor ◐ (проміжний план `football-plan-intermediate.md`)
- [x] Фаза 0 — підготовка, експорт контенту
- [x] Фаза 1 — схема v5 + baseline-міграція + seed, `prisma/sql/constraints.sql`
- [x] Фаза 2 (2a–2f) — identity, refresh-сесії, модерація, видалення акаунта, frontend-сесія, hardening
- [x] Фаза 3 — контент: статуси, мови з БД і fallback, контракт постів
- [x] Фаза 4 — engagement: треди коментарів, soft delete гілкою, purge, лайки
- [x] Рев'ю Фаз 1–4 — гонки коментарів / лайків, мапінг помилок Prisma 7, межа пароля в байтах
- [ ] Фаза 5 — Football + Sync на v5 (**наступна**)
- [ ] Фаза 5b — перемикач ліг у сайдбарі
- [ ] Фаза 6 — типи, документація (частково зроблено у Фазах 3–4)
- [ ] Фаза 7 — фінальна перевірка (частково покрито перевірками Фаз 2–4)
- [ ] Squash міграцій — безпосередньо перед релізом (етап 14)

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

- [x] `FootballIntegrationModule` — `integration/` (`football-data.client`, `football.mapper`).
- [x] `FootballPersistenceModule` — `persistence/` (`FootballRepository`).
- [x] `FootballQueryModule` — `query/` (`FootballQueryService`).
- [x] `FootballSyncModule` — `sync/` (`FootballSyncService`, `FootballLiveThrottleService`, `FootballCronService`).
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
- [ ] Борг: ESLint error `react-hooks/set-state-in-effect` у `LikeBar.tsx` (з 2e)
- [ ] Статистика дізлайків — лише в адмінці (етап 11)

---

### Етап 7 — Футбольні сторінки (web) + **альфа-scope**

Детальна карта маршрутів — у розділі **«Альфа-реліз: карта сторінок»** вище (кроки A–F). **Окремо від етапу 6** (спочатку лайки, потім цей блок).

#### 7.0 — Backend під альфу (паралельно з UI)
- [ ] **Передумова:** Фаза 5 проміжного плану — синк v5 (`Season`, `SeasonClub`, `Standing` по групах), запити через поточний сезон (`isCurrent`) з опційним `?season=2025-26`, публічні ендпоінти ліг (розділ 6.4)
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
- [ ] Маршрути з урахуванням сезону: `/leagues/[slug]?season=2025-26` (без параметра — поточний)
- [ ] Вигляд сторінки за `Competition.type`: LEAGUE → таблиця + тури, CUP → групи / ліга-фаза + сітка плей-оф
- [ ] Перемикач ліг у сайдбарі (`?league=`, групи «Ліги» / «Кубки») — **Фаза 5b проміжного плану**
- [ ] Новини ліги / клубу — через `PostCompetition` / `PostClub` (зв'язки вже пишуться з адмінки: `competitionIds` / `clubIds`; деталь поста віддає `competitions` / `clubs`)

#### 7.2 — Клуби (teams у generic naming)
- [ ] `/[locale]/clubs/page.tsx` — опційно
- [ ] `/[locale]/clubs/[clubSlug]/page.tsx` — картка клубу
- [ ] `/[locale]/clubs/[clubSlug]/matches/page.tsx` — матчі клубу

#### 7.3 — Матчі та календар
- [ ] `/[locale]/matches/page.tsx` — загальний список (фільтр по даті/лізі)
- [x] `/[locale]/matches/[id]/page.tsx` — деталь (коментарі на матчі — **етап 8**; лайки — **етап 6**)
- [ ] `/[locale]/calendar/page.tsx` — календар

#### 7.4 — Гравці / склад (поза мінімальною альфою, якщо немає Player у БД)
- [ ] Рішення: міграція `Player` + синк **або** відкласти після v1 альфи (модель спроєктовано: `Player`, `PlayerExternalRef`, `SquadMember { seasonId, clubId, playerId, shirtNumber, position }` — розділ 9 проміжного плану)
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
- [ ] Відображення «як в YouTube»: вирішити, чи сплющувати глибокі відповіді (YouTube — один рівень + `@згадка`), чи лишити дерево
- [ ] Пагінація дерева (зараз `GET` віддає весь тред; ріст обмежений cooldown-ом коментарів)
- [ ] Pin / lock / unlock — ендпоінти для адмінки (етап 11)

#### 8.2 — Frontend
- [x] `CommentSection.tsx` / `CommentThreadNode.tsx` — дерево відповідей для **поста**, «Відповісти» на кожному вузлі, підтвердження видалення з кількістю відповідей
- [ ] Те саме UX на **сторінці матчу** — API готовий, лишилось підключити `useComments` під `matchId`

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
- [ ] `UserFavoriteClub` — улюблений клуб (спроєктовано, розділ 9 проміжного плану)

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
- [ ] Журнал `SyncRun` на дашборді (Фаза 5 проміжного плану), керування `Competition.isActive`
- [ ] Статистика лайків і дізлайків (тільки адмін бачить дізлайки)
- [ ] Модерація коментарів: soft delete (API ✅), **purge / purge-thread** (API ✅ — з окремим підтвердженням, не плутати з «Delete»), lock / unlock треду, pin
- [ ] Користувачі: видалення акаунта (`DELETE /users/:id` — API ✅, пише `UserSanction(ACCOUNT_DELETED)`), ручні санкції, розблокування (див. бэклог безпеки)
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
- [ ] `hreflang` лише для мов, де є переклад (API вже віддає `availableLanguages`), `canonical` на EN-версію; потрібен `metadataBase` (абсолютний URL сайту)
- [ ] Title сторінки 404 для неіснуючого поста (зараз «Не вдалося завантажити пост» — косметика)
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

- [ ] GitHub Actions: lint + build при PR
- [ ] Vercel для web + admin
- [ ] Railway для api
- [ ] Environment variables в продакшні: `JWT_SECRET`, `EMAIL_HASH_SECRET` (≥ 32, випадкові; `EMAIL_HASH_SECRET` не змінювати після запуску), `CORS_ORIGINS` (https), `TRUST_PROXY` (кількість проксі), `NODE_ENV=production` (secure cookies); прибрати `JWT_REFRESH_SECRET`
- [ ] CORS оновити на продакшн домени
- [ ] Міграції: останній squash перед релізом (Частина 2) → прод з `0001_init`; `pg_dump` перед кожним `migrate deploy`
- [ ] Кілька інстансів API → Redis-сховище для throttler (зараз пам'ять процесу)

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
- [ ] Можливість скаржитись на коментар (report) — таблиця `ContentReport { reporterId, commentId, reason, status }` (спроєктовано, розділ 9 проміжного плану)
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
> Додано після рев'ю Фаз 1–2 і 2f (`football-plan-intermediate.md`). Поточний стан: throttler у пам'яті процесу, strikes анти-абузу — `UserSanction` за весь час, `sid` перевіряється запитом до `AuthSession`.

- [ ] **Anti-abuse на Redis:** sliding-window лічильник порушень (ZSET `abuse:<userId>:<action>`, score = timestamp, `ZREMRANGEBYSCORE` + `ZCARD`) замість strikes «за весь час»; `@nestjs/throttler` → Redis-сховище (ліміти спільні для всіх інстансів, переживають рестарт)
- [ ] **`POST /users/:id/unlock` (ADMIN):** ідемпотентний (уже ACTIVE → 200 без змін), аудит — `UserSanction.revokedAt` + запис «хто / коли / чому»; кнопка в адмінці користувачів (Етап 11)
- [ ] **Прогресивний бан** замість одразу permanent: 1 хв → 10 хв → 1 год → 1 день → permanent (рівень — з кількості порушень у sliding window); permanent — лише після ручного рішення або вичерпання рівнів
- [ ] **Email confirmation + anti-enumeration:** однакова відповідь `register` незалежно від зайнятості / блоку адреси — див. **Етап 13.5**
- [ ] **Session store для `sid` у Redis:** множина активних сесій користувача (instant revoke без запиту до БД на кожен запит; список «мої пристрої»); `AuthSession` у БД лишається джерелом правди для refresh / reuse-detection
- [ ] **CSRF для мутацій** (defence in depth поверх `SameSite=Lax` — див. Частину 1) — до публічного проду
- [ ] **Cooldown коментарів не атомарний** (з 2c): N паралельних коментарів проходять перевірку разом (до `burstThreshold − 1`); за потреби — `assert` + `record` під одним advisory lock
- [ ] **`POST /football/live-touch`** — публічний POST, що може витрачати квоту провайдера → ліміт на IP + лок через `SyncRun` (Фаза 5 проміжного плану)
- [ ] Лайк оновлює `updatedAt` поста / коментаря (Prisma `@updatedAt` на лічильнику) — не брати `updatedAt` для `lastmod` у sitemap без окремого поля

### Тести
- [x] Jest unit тести чистої логіки — **70** (переходи статусу поста, slug, `LanguageService`, дерево / піддерево коментарів, `prisma-errors`, `MaxUtf8Bytes`)
- [ ] Integration тести для API endpoints — у Фазах 2–4 були **тимчасові** скрипти (мінімальний Nest на dev-БД, справжні HTTP-запити з cookies, детерміновані гонки; сотні перевірок) і видалялись після прогону → перенести в `apps/api/test/` як e2e-набір на окремій БД
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
- **4.4 — Schema v5 (◐, проміжний план):** Фази 0–4 + рев'ю Фаз 1–4 ✅ — схема v5 і baseline-міграція; auth на refresh-сесіях, модерація, видалення акаунта; пости зі статусами й fallback перекладів; треди коментарів, purge; межа пароля в байтах.
- **6 — Лайки:** API + `LikeBar` на новині, коментарях і матчі; у v5 — журнал реакцій, анти-абуз, блокування цілі.

### У роботі / наступні за планом v4.5

1. **Проміжний план, Фаза 5** — Football + Sync на v5 (зараз `football/` не компілюється).
2. **Фази 5b → 6 → 7** проміжного плану (перемикач ліг, типи й документація, фінальна перевірка).
3. **7** — альфа football UI + агреговані ендпоінти + кеш.
4. **8** — коментарі на сторінці матчу (API готовий).
5. Далі **9+** за нумерацією в плані; перед публічним продом — CSRF і підтвердження пошти (13.5).

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

**БД:** PostgreSQL (Supabase). Prisma **schema v5** (домени identity / moderation / content / engagement / football / sync — Частина 2); ручні обмеження — `prisma/sql/constraints.sql`. Код football / sync — ще під v4 (Фаза 5 проміжного плану).
**Ліги:** Football-Data.org v4, синк + dashboard endpoint, LIVE throttle — переписується на v5 (порт провайдера, `*ExternalRef`, `SyncRun`, `Season`).
**Auth:** access-JWT 15 хв (`sid`) + opaque refresh-сесії в БД (ротація, reuse detection), **httpOnly** cookies (`sameSite: lax`), ролі ADMIN/USER; адмінка — `POST /auth/login/admin`.
**Безпека:** class-validator (межі — `packages/validation`), Helmet, суворий CORS, throttler (IP + акаунт), анти-абуз коментарів / лайків — є; **CSRF і підтвердження пошти — до публічного проду**.
**Архітектура:** Controller → Service → Repository → Prisma; football: підмодулі + mapper/client у `integration/`; soft delete Post/Comment (+ ADMIN purge коментаря); гонки — правило 10 Частини 1.

**Що вже зроблено:** auth v5 (сесії, видалення акаунта, модерація), posts + i18n (статуси, `lang` = `en`|`ua` з fallback), коментарі-треди з відповідями (новини; API матчів готовий), лайки, football API (v4) + сайдбар + `/matches/[id]`, admin (пости зі статусами, sync), next-intl + нормалізація Accept-Language `uk*`→`ua` у proxy.

**Альфа (див. план):** football UI — `leagues/*`, `clubs/*`, `matches` (список), `calendar`; бек — агреговані ендпоінти + кеш TTL; гравці/squad — коли з’явиться модель `Player` або окрема версія.

**Наступні кроки (порядок):** проміжний план — **Фаза 5** (Football + Sync на v5) → 5b → 6 → 7; потім **7** (альфа UI + API) → **8** (коментарі на матчі). Далі теги (9), профіль (10), адмінка (11+). Перед публічним продом: CSRF, **підтвердження пошти (Етап 13.5, бета)**; Helmet і throttler — ✅ Фаза 2d (`refactor/schema-v5`).

---