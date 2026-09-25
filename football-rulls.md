# ⚽ Football Portal — Project Plan & Rules

> **Версія:** 1.0  
> **Автор:** Олексій  
> **Статус:** MVP у розробці  
> **Останнє оновлення:** 2025

---

## 📌 1. Огляд проекту

Футбольний портал з новинами, матчами, клубами і таблицями ліг (EPL + Serie A).  
Проект є **production-ready pet-project** для портфоліо + пошуку роботи.  
Архітектура розрахована на масштабування: нові ліги, API-інтеграції, Redis, тести.

**Аудиторія:** футбольні вболівальники, читачі новин.  
**Ролі:** `admin` (пише новини, керує контентом) / `user` (читає, коментує).

---

## 🧱 2. Технологічний стек

### Frontend (SSR)
| Технологія | Версія | Призначення |
|---|---|---|
| Next.js | 16 (App Router) | Основний SSR фреймворк |
| React | 19 | UI |
| TanStack Query | latest | Server state management |
| Zustand | latest | Client state (auth, UI) |
| Tailwind CSS | latest | Стилі |
| next-intl | latest | Мультимовність (UA / EN) |

### Admin Panel (CSR — окремий додаток)
| Технологія | Призначення |
|---|---|
| Next.js або Vite + React | CSR-режим, окремий app |
| TanStack Query | Запити до API |
| Zustand | Стан |

### Backend
| Технологія | Призначення |
|---|---|
| NestJS | REST API |
| PostgreSQL | Основна БД |
| Prisma | ORM + міграції |
| JWT | Auth (access 15хв + refresh 7д) |
| Bcrypt | Хешування паролів |
| Helmet | HTTP заголовки безпеки |
| class-validator | Валідація DTO |

### Інфраструктура
| Сервіс | Призначення |
|---|---|
| Vercel | Деплой web + admin |
| Railway | Деплой API |
| Supabase / Neon | PostgreSQL хостинг |
| Cloudinary | Зображення |
| GitHub Actions | CI/CD |

---

## 🗂️ 3. Структура monorepo

```
football-portal/
├── apps/
│   ├── web/              # Next.js — публічний SSR сайт
│   ├── admin/            # Next.js/Vite — CSR адмінка
│   └── api/              # NestJS — REST API
├── packages/
│   ├── types/            # Shared TypeScript типи (DTO, entities)
│   ├── ui/               # Shared компоненти (Button, Card тощо)
│   ├── config/           # ESLint, Prettier, tsconfig base
│   └── utils/            # Shared утиліти (форматування дат тощо)
├── turbo.json
├── pnpm-workspace.yaml
└── .github/
    └── workflows/
        ├── ci.yml        # lint + build при PR
        └── deploy.yml    # деплой при merge в main
```

> **Ключова ідея:** `packages/types` — спільні типи між фронтом і беком.  
> Один `Post` interface — і в NestJS DTO, і в Next.js компонентах.

---

## 📄 4. Сторінки та функціонал

### Публічний сайт (web)
| Сторінка | URL | Опис |
|---|---|---|
| Головна | `/` | Банер, таблиця ліги, новини |
| Новина | `/news/[slug]` | Текст + коментарі |
| Клуб | `/clubs/[slug]` | Профіль клубу |
| Матч | `/matches/[id]` | Деталі матчу |
| Логін | `/auth/login` | JWT авторизація |
| Реєстрація | `/auth/register` | Реєстрація |
| Ліга | `/leagues/[slug]` | Таблиця + матчі ліги |

### Адмінка (admin)
| Функція | Опис |
|---|---|
| CRUD новин | Створення, редагування, видалення |
| Управління клубами | Базова інформація |
| Управління матчами | Результати, склади |
| Управління лігами | EPL, Serie A |
| Управління коментарями | Модерація |

---

## 🗄️ 5. Сутності БД (Prisma схема — основа)

```
User          — id, email, password, role (ADMIN/USER), name, avatar, createdAt
Post          — id, title, slug, content, excerpt, coverImage, authorId, published, createdAt
Comment       — id, content, postId, authorId, createdAt
League        — id, name, slug, country, season
Club          — id, name, slug, logo, leagueId
Match         — id, homeClubId, awayClubId, homeScore, awayScore, date, leagueId, status
LeagueTable   — id, leagueId, clubId, played, won, drawn, lost, points, position
```

---

## 🏛️ 6. Архітектурні правила

### Backend — Clean Architecture Light

Кожен модуль NestJS має таку структуру:

```
posts/
  post.controller.ts    ← тільки роутинг, без логіки
  post.service.ts       ← use cases / бізнес-логіка
  post.repository.ts    ← Prisma всередині, ховає ORM
  post.entity.ts        ← тільки якщо є бізнес-правила/методи
  dto/
    create-post.dto.ts
    update-post.dto.ts
```

**Rule 1 — Service = Use Cases** (описові імена методів)
```typescript
// ✅ Правильно
createPost(), publishPost(), getPostBySlug()

// ❌ Неправильно
handlePost(), processData()
```

**Rule 2 — Controller тупий** (приймає → делегує → повертає)
```typescript
@Post()
create(@Body() dto: CreatePostDto) {
  return this.postService.createPost(dto); // і все
}
// ❌ Ніякої логіки, умов, перетворень всередині
```

**Rule 3 — Repository ховає Prisma**
```typescript
// ✅ В сервісі
await this.postRepository.create(data);

// ❌ Ніколи напряму в сервісі
this.prisma.post.create(...)
```

**Rule 4 — Entity тільки коли є сенс**  
Не створювати entity "просто щоб було". Використовувати якщо є бізнес-правила, методи або валідація логіки (не форми).

**Rule 5 — DTO ≠ Entity**  
DTO — для API (вхідні/вихідні дані). Entity — для бізнес-логіки.

---

### Frontend — структура `apps/web`

```
apps/web/
├── app/                        # App Router (Next.js 16)
│   ├── [locale]/               # i18n wrapper
│   │   ├── page.tsx            # Головна
│   │   ├── news/[slug]/        # Сторінка новини
│   │   ├── clubs/[slug]/       # Сторінка клубу
│   │   ├── matches/[id]/       # Сторінка матчу
│   │   └── auth/               # Логін / реєстрація
├── components/
│   ├── ui/                     # Базові: Button, Card, Input
│   └── features/               # Фіча-компоненти: PostCard, MatchTable
├── hooks/                      # Кастомні хуки (useAuth, usePosts)
├── lib/
│   ├── api/                    # API клієнт (fetch wrapper)
│   └── utils/                  # Утиліти
├── store/                      # Zustand stores
└── types/                      # Локальні типи (якщо не в packages/types)
```

**Правила фронту:**
- **Server Component за замовчуванням** — `"use client"` лише для інтерактивності
- **API запити** — через TanStack Query, ніяких `useEffect + fetch` напряму
- **Компонент < 200 рядків** — більше → розбити
- **Логіка у хуки** — компонент рендерить, хук думає
- **`lib/api/`** — єдиний місць для fetch запитів до бекенду

---

## 🔐 7. Безпека (Security Rules)

> ❗ Ці правила є обов'язковими і не обговорюються.

### Backend (NestJS)
- `class-validator` у всіх DTO — валідація на рівні серверу
- `Helmet` підключений глобально — захист HTTP заголовків
- `CORS` налаштований явно — лише дозволені origins
- `ThrottlerModule` — rate limiting на `/auth/*` (max 5 req/хв)
- Паролі лише через `bcrypt` (saltRounds ≥ 10)
- JWT: access token 15 хвилин, refresh token 7 днів, зберігаються у httpOnly cookie
- Ніколи не повертати password у відповіді API
- `@Roles()` guard + `JwtAuthGuard` на захищених роутах

### Frontend (Next.js)
- `DOMPurify` — **обов'язково** для будь-якого user-generated HTML перед рендером
- Ніколи не використовувати `dangerouslySetInnerHTML` без попередньої санітизації
- `Content-Security-Policy` заголовок через `next.config.js`
- Змінні оточення: публічні лише з префіксом `NEXT_PUBLIC_`, секрети лише на сервері
- Токени НЕ зберігати в `localStorage` — лише httpOnly cookies

### XSS Prevention (обов'язково)
```typescript
// ✅ ПРАВИЛЬНО — завжди санітизувати перед відображенням
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userContent);
<div dangerouslySetInnerHTML={{ __html: clean }} />

// ❌ НЕПРАВИЛЬНО — ніколи так не робити
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

---

## 🎨 8. Style Guide (Code Rules)

### TypeScript
- `strict: true` у всіх tsconfig
- Ніяких `any` — замість цього `unknown` або явний тип
- Типи в `packages/types` для shared сутностей
- Іменування: `PascalCase` для компонентів/класів, `camelCase` для функцій/змінних, `SCREAMING_SNAKE_CASE` для констант

### React / Next.js
- Компоненти: максимум **200 рядків**. Якщо більше — розбити
- Бізнес-логіка НЕ у компонентах — виноситься у хуки (`hooks/`) або сервіси
- Назви компонентів: `PostCard.tsx`, `MatchTable.tsx` (описові, без `index.tsx` в корені)
- Server Components за замовчуванням — `"use client"` лише коли справді потрібен
- API-запити через TanStack Query — ніяких `useEffect` + `fetch` напряму в компонентах

### NestJS
- Feature-based структура модулів: `posts/`, `auth/`, `clubs/`, `matches/`
- DTO для кожного запиту (CreatePostDto, UpdatePostDto)
- Сервіси містять логіку, контролери — лише роутинг
- `ResponseDto` для уніфікованих відповідей API

### Загальне
- ESLint + Prettier — налаштовані в `packages/config`
- Коміти: `feat:`, `fix:`, `chore:`, `refactor:` (Conventional Commits)
- PR не мержити без успішного CI

---

## 🚀 9. Поетапний план реалізації (MVP)

### Знаходіться в файле плана 

## 🔮 10. Наступні кроки (після MVP)

- [ ] Redis кешування (популярні сторінки, таблиці)
- [ ] Football Data API інтеграція (автоматичне заповнення матчів)
- [ ] Jest тести (unit + integration)
- [ ] Docker + docker-compose для локальної розробки
- [ ] Пошук по новинах
- [ ] Лайки / збереження

---

## ⚡ 11. Правила розробки (Dev Rules)

> Ці правила потрібні щоб **не вигоріти** і **бачити результат щодня**

- ❗ **Один день = один видимий результат** (навіть маленький)
- ❗ **Одна фіча за раз** — не брати нову поки не закрита поточна
- ❗ **Застряг > 1 год?** → спрощуєш або питаєш у AI
- ❗ **Не робити "ідеально"** на MVP — зробити робочим, потім вдосконалити
- ❗ **Коміт кожен день** — навіть маленький прогрес фіксується

---

## 🤖 12. Контекст для AI (читати на початку нової сесії)

Якщо ти — AI і читаєш цей документ:

**Проект:** Футбольний портал (новини, матчі, клуби, ліги).  
**Стек:** Next.js 16 + React 19 + TanStack Query + Zustand (SSR) / NestJS + Prisma + PostgreSQL / pnpm monorepo + Turborepo.  
**Ліги:** EPL (Англія) + Serie A (Італія).  
**Auth:** JWT (access 15хв + refresh 7д), httpOnly cookies, ролі ADMIN/USER.  
**Безпека:** DOMPurify на фронті, class-validator на беку, Helmet, CORS, rate limiting.  
**Стиль:** TypeScript strict, компоненти < 200 рядків, feature-based структура, Conventional Commits.  
**Поточний статус:** [ОНОВЛЮВАТИ ПРИ КОЖНОМУ ЕТАПІ]  
**Наступний крок:** [ОНОВЛЮВАТИ ПРИ КОЖНОМУ ЕТАПІ]

---

*Документ потрібно оновлювати після завершення кожного етапу.*
