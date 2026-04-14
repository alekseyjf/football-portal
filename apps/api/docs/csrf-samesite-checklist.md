# CSRF та cookies (чеклист перед продом)

Короткий список, щоб не загубити при підготовці до продакшену.

## SameSite / cookies

- [ ] Переконатися, що `access_token` / `refresh_token` мають коректні `SameSite` (часто `Lax` для SPA з тим самим сайтом; `None` + `Secure` лише якщо фронт і API на різних доменах).
- [ ] У проді — лише `Secure` для cookies з токенами (HTTPS).

## CSRF для мутацій

- [ ] Обрати стратегію: **double-submit cookie**, **синхронizer token** у заголовку, або **custom header** (`X-Requested-With` / `X-CSRF-Token`) з перевіркою на API.
- [ ] Додати видачу/оновлення CSRF-секрету (наприклад, окремий GET після логіну або разом із сесією).
- [ ] Оновити `apps/web/src/lib/api/http.ts`: передавати токен у `apiPost` / `apiPut` / `apiDelete`.
- [ ] На Nest: middleware/guard, що для `POST`/`PUT`/`PATCH`/`DELETE` вимагає валідний CSRF (крім публічних ендпоінтів, якщо такі лишаються без cookies).

## CORS

- [ ] У проді звузити `origin` до реальних доменів фронту (не `*` з `credentials: true`).

## Пов’язане (не CSRF)

- [ ] Опційно: `COMMENT_COOLDOWN_MS` у `apps/api/.env` — інтервал між коментарями (мс), за замовчуванням 60000.
