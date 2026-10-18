# Правила: безпека

> Позначки: без позначки — чинне правило; ⭐ — нове 2026-10-08 (перечитай).

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
| `POST /football/live-touch` (публічний, витрачає квоту провайдера) | 10/хв з IP; + LIVE-синк турніру не частіше 60 с (через `SyncRun`) |

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

## ⭐ Нові правила (2026-10-08)

- ⭐ **Репозиторій публічний:** жодних секретів, дампів БД, cookie-файлів у git і в артефактах GitHub Actions (артефакти публічного репо видно всім). Дамп — лише зашифрований і в приватному сховищі ([D32](../decisions/D32-backups.md)).
- ⭐ **Секрети — свої для кожного середовища** (dev, тест, прод): `JWT_SECRET`, `EMAIL_HASH_SECRET` не переносимо між середовищами; `EMAIL_HASH_SECRET` на проді не змінюємо після запуску.
- ⭐ **Тест-сервер закритий:** Basic Auth + `noindex`; Swagger — лише за паролем; на проді Swagger вимкнений ([D31](../decisions/D31-test-environment.md)).
- ⭐ **Текст новин — Markdown без сирого HTML** ([D25](../decisions/D25-markdown-content.md)) — `dangerouslySetInnerHTML` у проєкті заборонено.
- ⭐ **Зовнішні URL, які API колись фетчитиме** (OG-превʼю, ресайз, імпорт) — лише після перевірки на приватні / локальні IP і без редиректів (вимога в `url-field.decorators.ts`).
- ⭐ Перед продом — CSP для web, 2FA для адміна, закриття адмінки, аудит залежностей (M3.2).
- ⭐ **Свіжі релізи npm — не раніше ніж через 7 днів** (2026-10-17, M1.3.2): `minimumReleaseAge: 10080` у `pnpm-workspace.yaml`, і для транзитивних залежностей — зламану версію зазвичай знімають з npm за години–дні. Терміновий патч безпеки — точна версія в `minimumReleaseAgeExclude`, через 7 днів рядок прибрати. Версії залежностей — діапазоном від конкретної версії (`^2.9.1`), не `latest`.
