# D59 — Шлюз сайту до API, `APP_ENV` і закритий тест-сервер

- **Статус:** ✅ прийнято · 2026-11-06 · 👤 рішення власника (бриф M1.11: секретний заголовок, IP від Vercel лише з секретом, Basic Auth, `APP_ENV`) + ⭐ деталі · код — перший PR M1.11; ⏳ наживо — після створення сервісів
- **Етап:** M1.11.3 (шлюз), M1.11.4 (`APP_ENV`, змінні), M1.11.6 (Basic Auth, `noindex`)
- **Уточнює:** [D31](D31-test-environment.md) (rewrites → Route Handler, `APP_ENV`), [D58](D58-test-hosting.md) (Vercel + Render), backend Rule 13 (нові змінні)

## Контекст
На тесті web і admin — на `*.vercel.app`, API — на `*.onrender.com`. Для браузера це різні сайти: cookies `SameSite=Lax` на домен API не підуть, тож браузер має ходити лише на домен сайту ([D31](D31-test-environment.md)). API на `*.onrender.com` при цьому видно всім: без захисту до нього можна йти напряму, повз пароль тест-сервера, і підробляти `X-Forwarded-For`, від якого залежать ліміти входу.

## Рішення

### Шлюз: браузер → сервер сайту → API
- ⭐ Браузер звертається лише до свого origin: `/api/v1/*` (і `/api/docs` — Swagger на тесті). Запит пересилає **Route Handler** `app/api/[...path]/route.ts` у web і адмінці (`forwardToApi`, `@football-portal/validation/site-gateway`).
  - *Чому не rewrites `next.config`:* rewrite не вміє додати заголовок запиту (полів для цього немає — документація Next 16.4). `NextResponse.rewrite` у `proxy.ts` на зовнішню адресу з заголовками документація не описує, тож на Vercel це не гарантовано. Route Handler — звичайний код, однаковий локально й на Vercel, з тестом.
  - Ціна: кожен запит браузера до API — виклик функції Vercel (на Hobby — у межах лімітів для тесту).
  - До API йдуть лише потрібні заголовки браузера: `cookie`, `content-type`, `accept`, `accept-language`, `user-agent`, `origin`, `sec-fetch-site`. Пароль Basic Auth (`authorization`), `host` і `x-forwarded-*` — ні. Відповідь — як є, кожен `Set-Cookie` окремо. Без `content-encoding` / `content-length`: `fetch` уже розпакував тіло.
  - API не відповів — 502, не встиг за 90 с — 504 (`API_UNAVAILABLE`): з запасом на прокидання Render, менше за межу функції Vercel.
- 👤 SSR ходить на API напряму (`API_ORIGIN`, серверна змінна).
  - ⭐ (2026-11-07, рев'ю M1.11) `apiFetch` web — `redirect: 'error'`, після `...init`, тож виклик його не перевизначить. *Чому:* `fetch` за замовчуванням іде за `Location` і несе туди свої заголовки, а з ними й секрет сайту. API не редиректить, тож 3xx — збій. Проксі браузера — `redirect: 'manual'`: редирект віддає браузеру. Тест — справжній HTTP-сервер з 302: чужий сервер не отримує жодного запиту (`http.test.ts`).
- ⭐ Адреса API більше не вбудовується в збірку: `NEXT_PUBLIC_API_URL` прибрано. Браузер завжди йде на `/api/v1`, сервер — на `API_ORIGIN`. Локально — та сама схема: `next dev` проксіює на `http://localhost:4000`, тож розбіжність «локально працює, на тесті — ні» ловиться вже на машині розробника.

### Секрет сервера сайту
- 👤 Сервери web і адмінки надсилають `x-origin-secret: <API_ORIGIN_SECRET>` — і SSR, і проксі. API зі змінною `API_ORIGIN_SECRET` без цього заголовка відповідає 403 `DIRECT_API_ACCESS_FORBIDDEN`. Виняток — лише `/api/v1/health`: хостинг, пінг GitHub Actions і монітор.
  - Порівняння — за сталий час (SHA-256 обох рядків, `timingSafeEqual`).
  - Секрет — новий, свій, ≥ 32 символи, не збігається з іншими секретами API (схема env).
  - Обов'язковий поза машиною розробника (`APP_ENV` ≠ `development`); локально без нього API відкритий, як раніше.
  - 👤 (2026-11-07, рев'ю M1.11) **Ротація без простою** — `API_ORIGIN_SECRET_PREVIOUS` в API: старий секрет на час ротації, API приймає обидва (порівнює з усіма, без раннього виходу). Лише разом з `API_ORIGIN_SECRET` і не рівний йому (схема env). Порядок: Render — новий секрет + старий у `…_PREVIOUS` → Vercel (web і адмінка) — новий → Render — прибрати `…_PREVIOUS`. *Чому:* Render і два проєкти Vercel деплояться окремо, і з одним значенням між деплоями було б вікно 403. Як `REVALIDATE_SECRET_PREVIOUS` у web ([D57](D57-scheduled-publishing.md)).
- 👤 **IP клієнта.** Проксі передає IP браузера в `x-client-ip`: перший у `x-forwarded-for`, який Vercel переписує сам (клієнт його не підробить). API бере його в `req.ip` **лише** із правильним секретом. З `req.ip` працюють throttler і `AuthSession.ipAddress`.
  - ⚠️ (2026-11-07, рев'ю M1.11) Так — лише на Vercel: `next start` ставить адресу сокета, тільки коли заголовка немає (`??=`, Next 16.4), і клієнт підставить будь-який IP. Власний сервер web (M3.1) бере IP від свого reverse proxy ([`backlog.md`](../backlog.md)).
- ⭐ `TRUST_PROXY=false` на Render: `X-Forwarded-For` API не довіряє зовсім. Запит без секрету однаково отримує 403, а SSR IP не передає (браузера там немає) — для нього `req.ip` = адреса балансувальника Render, і жоден ліміт на IP його не стосується.

### `APP_ENV` — де працює сервер
- ⭐ `development` | `test` | `production`, окремо від `NODE_ENV` (той — `production` і на тесті, і на проді). Значення ті самі в API, web і адмінці.
- ⭐ З `NODE_ENV=production` змінна обов'язкова: забута змінна — помилка старту, а не тест-сервер без пароля. Через це локальний `next start` теж задає `APP_ENV=development` (страж `test:runtime-env` — так само).
- Що вмикає:
  - API: Swagger — усюди, крім `production`. На тесті його видно лише через сайт (з секретом) і за паролем.
  - web і адмінка: `development` — дефолти localhost, без секрету й пароля; `test` — Basic Auth і обов'язкові `API_ORIGIN` (https; http — лише loopback), `API_ORIGIN_SECRET`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` (≥ 12 символів — його вводять люди); `production` — без пароля.
- Індексацію web, як і раніше, вирішує окрема `SITE_INDEXING` (M1.8.3), а не `APP_ENV`.

### Закритий тест-сервер (M1.11.6)
- 👤 Basic Auth — у `proxy.ts` web і адмінки (Password Protection Vercel — лише на Pro, [D58](D58-test-hosting.md)).
  - Під паролем: сторінки й шлюз `/api/*`.
  - Без пароля: вебхук `/api/revalidate` (має свій підпис, D57), `robots.txt`, статика Next, файли з розширенням (зокрема статика Swagger).
  - Невалідні змінні тесту — не пускає нікого; `APP_ENV` не задано з `NODE_ENV=production` — пароль потрібен.
- `noindex`:
  - адмінка — `X-Robots-Tag: noindex, nofollow` і `robots.txt` `Disallow: /` у будь-якому середовищі;
  - API — `X-Robots-Tag` на кожній відповіді, і на пересланих сайтом;
  - web — як і раніше, за `SITE_INDEXING`.

## Наслідки
- Нові змінні:
  - API: `APP_ENV`, `API_ORIGIN_SECRET`, на час ротації — `API_ORIGIN_SECRET_PREVIOUS`;
  - web і адмінка: `APP_ENV`, `API_ORIGIN`, `API_ORIGIN_SECRET`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`;
  - прибрано `NEXT_PUBLIC_API_URL` (web, адмінка).
  - Перелік — `.env.example` кожного застосунку. Змінні Vercel задаються і для Production, і для Preview: без них сервер не стартує.
- ⚠️ Preview Vercel (👤 лишаємо) ходить на той самий тестовий API. Тож він валідний лише для змін без змін API. Ще й мутації (вхід, коментар) з preview дадуть 403 CSRF: origin preview немає в `CORS_ORIGINS` ([D60](D60-csrf.md)). Preview — для перегляду сторінок.
- Swagger на тесті — `https://<web>.vercel.app/api/docs` (за паролем), «Try it out» іде тим самим шлюзом.
- Перевірено локально (2026-11-06), API на схемі `e2e` + `next start` web і адмінки з `APP_ENV=test`:
  - без пароля — 401, з ним — сторінки й SSR з даними;
  - вхід через `/api/v1` — обидва cookies на домені сайту, `me` — користувач;
  - API напряму без секрету — 403, `/health` — 200;
  - два клієнти з різним IP — різні ліміти входу (11-та спроба першого — 429, другий — 401);
  - адмінка — `SameSite=Strict`, дашборд через свій шлюз;
  - Chrome: пароль, введений один раз, браузер сам додає до `fetch` сторінки.
  - ⏳ Наживо на Render і Vercel — після створення сервісів (M1.11.3).

## Розглянуті альтернативи
- Rewrites `next.config` / `vercel.json` — не додають заголовок запиту.
- `proxy.ts` з `NextResponse.rewrite` на зовнішню адресу — поведінка заголовків на Vercel не задокументована.
- Лише `TRUST_PROXY` з кількістю хопів без секрету — до API на `*.onrender.com` можна йти напряму з підробленим `X-Forwarded-For`, а сам API відкритий повз пароль тест-сервера.
- Окремий домен API зі `SameSite=None` — безкоштовні домени хостингів — різні сайти (cookies третьої сторони), і CSRF стає складнішим.
