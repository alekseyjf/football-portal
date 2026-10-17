# Реєстр рішень

Кожне рішення має ID. Старі ID (D1–D20, P2-* … P5b-*, R*, 🧭 п. N) **не змінюються** — на них посилаються коментарі в коді. Нові рішення — окремими файлами у форматі ADR (контекст → рішення → наслідки → альтернативи), нумерація продовжується з D21.

Статуси: ✅ діє · 🔁 змінено (див. нове рішення) · ⛔ скасовано · ⏳ ще не реалізовано.

## Рішення схеми v5 (історія, з обґрунтуваннями)

| Файл | Що всередині | ID |
|---|---|---|
| [v5-foundation.md](v5-foundation.md) | Навіщо v5, ключові рішення, домени, ручні обмеження БД, «спроєктовано», міграції | D1–D20 |
| [v5-identity.md](v5-identity.md) | Auth, refresh-сесії, видалення акаунта, модерація, ліміти, hardening | P2-1 … P2-29 |
| [v5-content.md](v5-content.md) | Пости, мови, fallback, статуси, slug | P3-1 … P3-10 |
| [v5-engagement.md](v5-engagement.md) | Треди коментарів, soft delete, purge, лайки, гонки | P4-1 … P4-9, R1 … R7 |
| [v5-football.md](v5-football.md) | Синк, провайдер, сезони, LIVE, перемикач ліг | P5-1 … P5-17, P5b-1 … P5b-9, R5a-1 … R5a-6, F1 … F10 |
| [v5-architecture-review.md](v5-architecture-review.md) | Рев'ю архітектури перед новими етапами, принципи | 🧭 п. 1 … 15 |

## Нові рішення (з 2026-10-08)

| ID | Рішення | Етап |
|---|---|---|
| [D21](D21-docs-structure.md) | Документація розбита на частини в `docs/` | M1.1 |
| [D22](D22-ukrainian-language-code.md) | Код української мови — `uk` скрізь | M1.2 |
| [D23](D23-content-languages.md) | EN обов'язкова, UK — з fallback на EN | M1.4 |
| [D24](D24-news-url-slug-number.md) | URL новини `{slug}-{номер}`, slug для кожної мови | M1.4 |
| [D25](D25-markdown-content.md) | Текст новин у Markdown | M1.4 |
| [D26](D26-post-sources.md) | Джерела новини — таблиця `PostSource` | M1.4 |
| [D27](D27-youtube-style-comments.md) | Коментарі як на YouTube | M1.7 |
| [D28](D28-openapi-contract.md) | OpenAPI (Swagger) як джерело правди контракту | M1.3 |
| [D29](D29-strict-typescript-api.md) | Суворий TypeScript в API | M1.3 |
| [D30](D30-testing-and-local-env.md) | Тести й середовище: без Docker локально | M1.3, M1.10 |
| [D31](D31-test-environment.md) | Тест-сервер: закритий, без індексації, rewrites | M1.11 |
| [D32](D32-backups.md) | Бекапи | M1.11, M3.5 |
| [D33](D33-observability.md) | Health, Sentry, алерти в Telegram, Pino | M1.3 … M3.5 |
| [D34](D34-seo-multilingual.md) | SEO багатомовного сайту | M1.8 |
| [D35](D35-caching-measure-first.md) | Кеш: спершу вимірювання | M2.12 |
| [D36](D36-sync-operations.md) | Синк: прапорець cron, пропуск завершених турнірів | M1.11 |
| [D37](D37-anti-abuse-strike-window.md) | Strike-и за 30 днів, розблокування адміном | M1.7, M2.6 |
| [D38](D38-news-list-load-more.md) | «Завантажити ще» з посиланнями | M1.6 |
| [D39](D39-milestones-and-dod.md) | Віхи й Definition of Done | — |
| [D40](D40-development-process.md) | Процес розробки | — |
| [D41](D41-single-instance-scaling.md) | Один інстанс; Redis і worker — за тригером | — |
| [D42](D42-no-club-name-translation.md) | Назви клубів не перекладаємо | — |
| [D43](D43-archived-posts.md) | `ARCHIVED` = знято з публікації | — |

## Як додати рішення
1. Новий файл `D<N>-<коротка-назва>.md` за шаблоном: **Статус** (дата, 👤 / ⭐), **Етап**, **Замінює / уточнює**, **Контекст**, **Рішення**, **Наслідки**, **Розглянуті альтернативи**.
2. Якщо рішення змінює старе — в таблиці «Що змінилось» відповідного `v5-*.md` додати рядок 🔁 з посиланням.
3. Рядок у таблицю вище.
