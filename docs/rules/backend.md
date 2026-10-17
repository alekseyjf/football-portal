# Правила: backend (NestJS, Prisma)

> Підхід: **Senior Full-Stack Architect** — кожне рішення з урахуванням масштабування, безпеки й підтримки. Правило №1: найдорожча річ у backend — зміна схеми після запуску.
> Позначки: без позначки — чинне правило (узгоджене раніше); ⭐ — нове або змінене 2026-10-08 (перечитай).

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

> ⭐ **Зміна до Rule 1** (після M1.3): користувач — через декоратор `@CurrentUser()`, без `req.user as AuthenticatedUser` ([D29](../decisions/D29-strict-typescript-api.md)):
> ```typescript
> @Post()
> create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthenticatedUser) {
>   return this.postService.createPost(dto, user.id);
> }
> ```

---

## ⭐ Нові правила (2026-10-08)

**Rule 11 — Відповідь API = response DTO + Swagger** ([D28](../decisions/D28-openapi-contract.md))
```typescript
// ✅ Окремий клас відповіді з @ApiProperty (не модель Prisma); toPublic*(row) повертає його форму
// ✅ Кожен ендпоінт описаний у Swagger — типи web / admin генеруються з цієї схеми (openapi-typescript)
// ❌ Повертати рядок Prisma чи «ReturnType<…>» без опису контракту
```

**Rule 12 — Межі для кожного вхідного параметра** (🧭 п. 6)
```typescript
// Глобального throttle немає свідомо (SSR ходить з одного IP) → кожен query-параметр обмежений у DTO:
// page ≤ 100 000, limit ≤ 50…100, список slug-ів ≤ 20, інтервал дат ≤ 32 доби; невалідне → 400, не 500
```

**Rule 13 — Конфіг лише через перевірену схему env**
```typescript
// ✅ Усі змінні середовища описані в одній схемі й перевіряються при старті (API не стартує з поганим конфігом)
// ❌ process.env.X у бізнес-коді
```

**Rule 14 — Суворий TypeScript** — `strict: true` в API так само, як у web / admin ([D29](../decisions/D29-strict-typescript-api.md)).

**Rule 15 — Синк football** — правила (власність полів, дельта, без голого `upsert`, `Match` не видаляється, лок `SyncRun`) — [`decisions/v5-football.md`](../decisions/v5-football.md), «Правила синку». Кожна нова сутність провайдера (`Player`, `MatchEvent`) — за ними ж.

**Rule 16 — Міграції** — до релізу дозволено squash; після — лише нові міграції, expand → backfill → contract, SQL читаємо (`--create-only`), `constraints.sql` не губимо, `pg_dump` перед `migrate deploy` — [`decisions/v5-foundation.md`](../decisions/v5-foundation.md), розділ 11.

**Rule 17 — Лайки** — окремі таблиці на тип цілі (`PostLike`, `CommentLike`, `MatchLike`), лічильники — у тій самій транзакції; `DISLIKE` зберігаємо, але публічно не показуємо (бачить лише адмін).
