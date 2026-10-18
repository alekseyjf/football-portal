# D33 — Спостережуваність: health, Sentry, алерти в Telegram, Pino

- **Статус:** ✅ прийнято · 2026-10-08 · 👤 рішення власника (10.6, 13.8) + ⭐ терміни
- **Етап:** M1.3 (`/health`), M1.11 (uptime), M2.1 (Sentry, алерти), M3.5 (Pino)
- **Реалізує:** [🧭 п. 13](v5-architecture-review.md)

## Рішення
- 👤 `GET /health` — ⭐ через `@nestjs/terminus`: ping БД з таймаутом, без деталей інфраструктури у відповіді.
  - *M1.3.3:* `GET /api/v1/health` — terminus **11.1.1** (12.x лише ESM, API — CommonJS + Jest), `PrismaHealthIndicator`: `SELECT 1` з таймаутом 3 с → 200 / 503, у відповіді лише `status` (адресу БД з помилки з'єднання terminus не віддає), `Cache-Control: no-store`. Один ендпоінт з БД, без окремих liveness / readiness (один інстанс, [D41](D41-single-instance-scaling.md)).
- ⭐ Uptime-монітор на `/health` (UptimeRobot або Better Stack, безкоштовно) → 👤 Telegram — уже на тест-сервері.
- 👤 Sentry для web, admin і API — ⭐ уже на тесті (M2.1): помилки тестувальників видно без їхніх скриншотів.
- 👤 Алерт у Telegram: `SyncRun FAILED` N разів поспіль — інакше football-дані мовчки застаріють.
- 👤 Pino (`nestjs-pino`) перед продом: JSON-логи, `requestId` на кожен запит, приховування токенів і паролів, `syncRunId` / турнір / тривалість у логах синку; локально — `pino-pretty`.

## Розглянуті альтернативи
- Лише логи хостингу — відхилено: про проблему дізнаємося від користувачів.
