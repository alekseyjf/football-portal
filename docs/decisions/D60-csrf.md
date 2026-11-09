# D60 — CSRF: Fetch Metadata і `Origin` для мутацій, лише JSON; cookies адміна — `SameSite=Strict`

- **Статус:** ✅ прийнято · 2026-11-06 · 👤 рішення власника (OQ-6, бриф M1.11: перенесено з M1.11.9 у перший PR — деплой раніше) + ⭐ деталі
- **Етап:** M1.11 (перший PR)
- **Закриває:** [OQ-6](../open-questions.md); `rules/security.md`, розділ «CSRF»

## Контекст
Сесія — httpOnly cookies, `SameSite=Lax`. Lax не шле cookies у cross-site `POST` з чужої сторінки, і для класичного CSRF цього майже досить. Проте Lax — не повний захист: піддомени одного сайту (`same-site`) і помилки браузерів лишаються. OWASP радить поверх SameSite перевіряти Fetch Metadata і `Origin`; токен (double-submit) — лише коли є клієнт з іншого сайту. Таких клієнтів у нас немає.

## Рішення
- 👤 Express-middleware в API (`security/request-gate/cross-site-request.ts`) — до розбору тіла й cookies, на `POST` / `PUT` / `PATCH` / `DELETE`:
  - `Sec-Fetch-Site: same-origin` — пропускаємо: сторінка того самого origin (сайт через свій шлюз, [D59](D59-site-gateway.md); Swagger UI самого API);
  - `Sec-Fetch-Site: cross-site` — 403 `CROSS_SITE_REQUEST_FORBIDDEN`;
  - інакше `Origin`, якщо є, — лише з `CORS_ORIGINS` (сайт і адмінка), інакше 403;
  - без обох заголовків — пропускаємо: це не браузер (curl, тести, сервер). Браузер мутацію з іншого сайту без `Origin` не шле.
- 👤 Тіло мутації — лише `application/json`, інакше 415 `UNSUPPORTED_MEDIA_TYPE`: HTML-форма чужого сайту JSON надіслати не може. Мутація без тіла (`refresh`, `logout`) типу не має — пропускаємо. Порожня форма тип має — 415.
- 👤 Перевірено: жоден `GET` нічого не пише. Сервіси читання (пости, теги, коментарі, футбол, лайки, журнал синків) не мають записів у БД. `GET /auth/me` і `JwtStrategy` лише читають. Тож читання перевірка не чіпає.
- 👤 Cookies сесії **адміна** — `SameSite=Strict` (вхід і refresh; роль — у `AuthTokens`), решти — `Lax`. *Чому нічого не ламає:* cookies читає лише `fetch` зі сторінки того самого сайту, SSR іде без них. Перевірено e2e (вхід і refresh адміна) і в Chrome (адмінка через свій шлюз).
- Через шлюз сайту API бачить заголовки браузера: проксі пересилає `origin` і `sec-fetch-site` ([D59](D59-site-gateway.md)).

## Наслідки
- Мутації з preview Vercel — 403: origin preview немає в `CORS_ORIGINS` ([D59](D59-site-gateway.md)).
- Новий клієнт API з іншого сайту (мобільний застосунок — без cookies, не зачепить; інший вебсайт — зачепить): його origin — у `CORS_ORIGINS`, або тоді токен.
- `csurf` не використовуємо (застарів).
- Перевірено:
  - unit — `cross-site-request.spec.ts`;
  - e2e — `test/security/request-gate.e2e-spec.ts`: чужий сайт — 403 до контролера, свій і не браузер — 200, форма й `text/plain` — 415, `GET` з чужого сайту — 200;
  - `SameSite=Strict` адміна при вході й refresh — `test/auth/admin-login.e2e-spec.ts`;
  - контрольний прогін з вимкненою перевіркою — червоний.

## Розглянуті альтернативи
- Токен double-submit — потрібен лише клієнтам з іншого сайту; додає видачу токена й заголовок у кожну мутацію web і адмінки.
- Лише `SameSite` — без захисту в глибину ([OQ-6](../open-questions.md)).
- `SameSite=Strict` для всіх — так само нічого б не зламав, але власник обрав лише адміна; користувачу сайту Lax досить разом із перевіркою вище.
