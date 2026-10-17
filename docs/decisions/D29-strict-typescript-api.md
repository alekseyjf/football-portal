# D29 — Суворий TypeScript в API

- **Статус:** ✅ прийнято · 2026-10-08 · 👤 рішення власника (13.4, 13.5)
- **Етап:** M1.3

## Контекст
Web, admin і пакети — `strict: true`; API — дефолти Nest (`noImplicitAny: false`, `strictBindCallApply: false`). Виміряно 2026-10-06: `noImplicitAny` → **0** помилок, повний `strict` → **12** (усі TS2564 — поля DTO без ініціалізатора).

## Рішення
- 👤 Увімкнути зараз, поки кодова база мала: `noImplicitAny` → `strict: true` одним PR; поля DTO, які заповнює class-transformer, — з `!`.
- 👤 Разом — декоратор `@CurrentUser()` замість `req.user as AuthenticatedUser` (такі касти ховають помилки типів).

## Наслідки
- Однакова суворість у всіх застосунках; правило — `docs/rules/code-style.md`.
