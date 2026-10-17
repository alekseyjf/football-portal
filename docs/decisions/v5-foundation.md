# Рішення v5 — основа: схема, домени, міграції

> **Звідки:** проміжний план schema v5 (`docs/archive/football-plan-intermediate.md`, розділи 0–4, 5.1, 9, 11) і старий основний план (`docs/archive/football-plan-v4.7.md`, «Prisma та міграції»). Текст нижче — **дослівно**, номери розділів і рішень збережено: на них посилаються коментарі в коді.
> **Джерело правди схеми — код:** `apps/api/prisma/schema.prisma` + `apps/api/prisma/sql/constraints.sql`. Повний текст цільової схеми (розділ 5 проміжного плану) тут не дублюємо — він в архіві.

## Що змінилось після 2026-10-08

| Рішення | Стан | Що тепер |
|---|---|---|
| D8 | ✅ діє, уточнено | Код української мови — `uk` скрізь (не `ua`) — [D22](D22-ukrainian-language-code.md) |
| D9 | 🔁 змінено | «`slug` один на пост» → свій slug для кожної мови + номер в URL — [D24](D24-news-url-slug-number.md); fallback на EN лишається — [D23](D23-content-languages.md) |
| D10 | ✅ діє, уточнено | `ARCHIVED` = знято з публікації (404) — [D43](D43-archived-posts.md) |
| D12 | 🔁 змінено | Відповіді — одним рівнем, як на YouTube — [D27](D27-youtube-style-comments.md) |
| Розділ 9 | 🔁 оновлено | Актуальна таблиця «Спроєктовано, але ще не створено» — `docs/football-plan.md`, розділ 10 |
| Розділ 11, «Prisma та міграції» | ✅ діє | Останній squash — перед першим прод-деплоєм (M3.1) |

Решта рішень — ✅ діє.

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

## 📌 Prisma та міграції — **рішення на зараз** (узгоджено)

- **`LikeType`:** залишаємо **`enum LikeType { LIKE DISLIKE }`**, **без** переходу на `String` + CHECK, доки немає реальної потреби.
- **Атомарність:** створення / оновлення поста — одна nested-операція (поля + переклади + зв'язки); багатокрокові зміни з лічильниками — `$transaction` за правилом 10 Частини 1.
- **Інваріанти, яких Prisma не виражає**, — у `prisma/sql/constraints.sql`: рівно одна ціль треду, різні клуби матчу, опублікований / запланований пост має дату, одна default-мова, один поточний сезон турніру, один `RUNNING` синк на ціль, формат анонімізованих email.
- **Squash до релізу** (розділ 11 архівного проміжного плану): поки немає прод-БД, історію міграцій схлопуємо — `migrate reset` → `migrate dev --name init --create-only` → **дописати `constraints.sql` у baseline** → `migrate dev` → `db seed`. Останній squash — безпосередньо перед релізом (етап 14): прод стартує з однієї `0001_init`. Зараз міграцій п'ять: `0001_init` … `0005_language_code_uk`.
- **Після релізу:** застосовані міграції не редагуємо й не видаляємо; структурні зміни — expand → backfill → contract (окремі міграції / деплої); кожну міграцію генеруємо з `--create-only` і читаємо SQL (Prisma любить `DROP` + `ADD` замість `RENAME`; перевіряти, що не зникли об'єкти з `constraints.sql`); `pg_dump` перед кожним `migrate deploy`.
- Supabase: `migrate` іде через `DIRECT_URL` (`prisma.config.ts`).
