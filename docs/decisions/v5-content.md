# Рішення v5 — контент (пости, мови)

> **Звідки:** `docs/archive/football-plan-intermediate.md` — розділ 8, Фаза 3 (контекст, P3-1 … P3-10, рев'ю Фази 3). Текст — **дослівно**, номери збережено.

## Що змінилось після 2026-10-08

| Рішення | Стан | Що тепер |
|---|---|---|
| Розділ 8: «`Language` seed: `en`, `ua`» | 🔁 змінено | `en`, `uk` — [D22](D22-ukrainian-language-code.md) |
| Розділ 8: «`slug` один … не змінюється після публікації» | 🔁 змінено | Свій slug для кожної мови + номер — [D24](D24-news-url-slug-number.md) |
| Розділ 8: «SEO: `hreflang` … `canonical` на EN» | ✅ діє, уточнено | [D34](D34-seo-multilingual.md) |
| P3-4: `sourceUrl` | 🔁 змінено | Джерела — таблиця `PostSource` — [D26](D26-post-sources.md) |
| P3-5: EN обов'язковий | ✅ діє | UK — опційний, з fallback на EN — [D23](D23-content-languages.md) |
| P3-6: slug із суфіксом колізії | 🔁 змінено | Номер в URL — slug більше не мусить бути унікальним — [D24](D24-news-url-slug-number.md) |
| «Свідомо не робимо»: hreflang, редагування, пагінація `admin/all` | ⏳ | M1.8, M1.5, M1.4.8 |

Решта рішень — ✅ діє.

---

## 8. Контент: мови і fallback

- `Language` seed: `en` (isDefault), `ua`.
- **Запит `?lang=xx`:** беремо переклад `xx`, інакше переклад мови `isDefault`. У відповіді повертаємо `resolvedLanguage`, щоб UI міг показати «Переклад недоступний» і правильний `lang` атрибут.
- **Невідома або неактивна мова** в `lang` → default, без 400.
- **Створення поста:** EN обов'язковий (валідація в сервісі: є переклад мови `isDefault`), решта опційні.
- **`slug`:** один, генерується з EN-заголовка, не змінюється після публікації.
- **SEO:** `hreflang` лише для мов, де є переклад; для решти — `canonical` на EN-версію.
- **Стрічка:** `status IN (PUBLISHED, SCHEDULED) AND deletedAt IS NULL AND publishedAt <= now()` → `ORDER BY publishedAt DESC` (виправлено у Фазі 3, P3-1: з `status = PUBLISHED` запланований без cron-а не виходив би ніколи).
- **`SCHEDULED`:** достатньо фільтра вище — статус у БД лишається `SCHEDULED`, окремий job не потрібен.

---

#### 3.0 Знайдено при аналізі (Фаза 3)

Знайдено при аналізі:
- **Розділ 8 суперечить сам собі:** фільтр `status = PUBLISHED AND publishedAt <= now()` без cron-а означає, що `SCHEDULED` не з'явиться ніколи → P3-1
- `GET /posts/:slug` фільтрує лише `deletedAt` → **DRAFT відкривається за slug**; лайк чернетки теж проходить (`LikeRepository.assertPostExists`)
- `PUT /posts/:id` — «author or ADMIN»: з `status` в update розжалуваний автор міг би публікувати → P3-7
- `?page=abc` → `NaN` у `skip` → 500; у DTO постів немає меж довжин; неіснуючий `tagId` → FK → 500
- `ValidationPipe` — `whitelist` без `forbidNonWhitelisted`: стара адмінка з `published: true` мовчки створила б DRAFT → API і адмінка міняються **в одному коміті**
- web читає коментарі через `GET /comments/post/:id`, а не з деталі поста — `comments` з деталі можна прибрати без змін UI

---

#### 3.1 Рішення (доповнюють розділ 8)

| # | Рішення | Чому |
|---|---|---|
| P3-1 | **Живий пост** = `deletedAt IS NULL AND status IN (PUBLISHED, SCHEDULED) AND publishedAt <= now() AND ∃ переклад default-мови`. Один предикат (`livePostWhere`) для стрічки, деталі за slug і `LikeRepository.assertPostExists`. Cron-а немає: `SCHEDULED` стає видимим сам, статус у БД лишається `SCHEDULED` (адмінка показує «Published» за датою) | Розділ 8 дозволяє «лише фільтр», але буквальний `status = PUBLISHED` ховав би заплановані назавжди. Чернетка не відкривається за slug і не лайкається |
| P3-2 | Переходи статусу — чиста функція `resolvePostPublication` (unit-тести): **DRAFT** → `publishedAt = null`, дата в запиті → 400; **PUBLISHED** → дата з запиту (лише ≤ now, минула — дозволено) / наявна / `now()`; **SCHEDULED** → дата з запиту або наявна, обов'язково > now; **ARCHIVED** → дата не змінюється, при створенні заборонено. Оновлення без `status` валідує дату проти поточного статусу | Інваріант CHECK `Post_published_has_date_check` тримає сервіс, а не 500 з БД; перенос запланованого без зміни статусу працює |
| P3-3 | `LanguageService` (`src/languages/`): мови з БД, кеш у пам'яті 60 с. Читання: `lang` невідомий / неактивний / не рядок → default, без 400. Запис: `languageCode` перекладу — лише активна мова (400 `UNSUPPORTED_LANGUAGE`), дублікати — 400. Перевірка в сервісі, не в DTO (потрібна БД) | Нова мова = `INSERT` без редеплою (D8); кеш — щоб не читати `Language` на кожен запит |
| P3-4 | Контракт відповіді: переклад **розгорнуто** в пост (`title`, `excerpt`, деталь — `content`) + `resolvedLanguage`; масиву `translations` у публічних відповідях немає — fallback живе лише в API (`getTranslation` на web прибрано). `coverImage` → `coverImageUrl`; дата в UI — `publishedAt` (за нею ж сортування). Деталь: + `videoUrl`, `sourceUrl`, `availableLanguages` (для `hreflang`), `competitions`, `clubs`; `comments` прибрано | Одне місце для fallback; web не знає, яка мова default |
| P3-5 | Інваріант «кожен пост має переклад default-мови»: обов'язковий при створенні, видалити переклад через API не можна. Публічні запити додатково фільтрують `translations some default` | Якщо інваріант колись порушиться (зміна default-мови без backfill), пост зникне зі стрічки, а не зламає fallback / пагінацію |
| P3-6 | Slug: з заголовка default-мови, NFKD → ASCII, ≤ 80 символів, порожній → `post`; колізія (`P2002`) → суфікс `-<6 hex>` (3 випадкові байти), до 5 спроб. Генерується **один раз** при створенні (суворіше за «не змінюється після публікації»; редагування slug чернетки — адмінка, етап 11) | Замість `…-1775485815788`; унікальність тримає `@unique` без гонки |
| P3-7 | `PUT /posts/:id` → **лише ADMIN** (було: автор або ADMIN). `DELETE` — атомарний `updateMany where deletedAt null`, повтор → 404, відповідь `{ id }` (не весь рядок) | Створення вже лише з адмінки; з `status` в update колишній адмін-автор міг би публікувати |
| P3-8 | `tagIds` / `clubIds` / `competitionIds`: унікальні, ≤ 20, існування перевіряється → 400 `UNKNOWN_TAG` / `UNKNOWN_CLUB` / `UNKNOWN_COMPETITION`; в update переданий масив **замінює** зв'язки, відсутній — не чіпає | Замість 500 на FK; семантика як у v4 для тегів |
| P3-9 | Межі в `packages/validation` (trim): title 5–200, excerpt 10–500, content 20–100 000; query `page` 1–100 000, `limit` 1–50; JSON-тіло API — 1 MB (`JSON_BODY_LIMIT`) | Ті самі числа в DTO і формі адмінки (P2-25); `NaN` / `1e20` → 400 замість 500; UA-переклад на 100 000 символів кирилицею ≈ 200 KB — у дефолтні 100 KB Express не влазив |
| P3-10 | Адмінка: «View on site» лише для живих постів; бейдж статусу з урахуванням дати | Посилання на чернетку дало б 404 |

Свідомо не робимо: `hreflang` / `canonical` на web — немає `metadataBase` (абсолютного URL сайту), API вже віддає `availableLanguages` → етап SEO; редагування / зміна статусу існуючого поста в адмінці — етап 11 (API `PUT` готовий); пагінація `GET /posts/admin/all` — етап 11.

---

#### Рев'ю Фази 3 (2026-09-26)
Звірено код з пунктами 3a, P3-1…P3-10 і розділом 8; граничні випадки — пробами на dev-БД (тимчасовий Nest, як у 3a). Знайдено й виправлено:
- [x] **`publishedAt: null`** проходив `@IsOptional`, сервіс робив `new Date(null)` → PUBLISHED з датою **1970-01-01** (і `PUT { publishedAt: null }` переписував дату живого поста). Тепер `null` = не передано (`post.service.ts`), тип DTO `string | null`
- [x] **Lost update:** `update` завжди писав `status` / `publishedAt`, обчислені з прочитаного на початку запиту стану → правка заголовка перезаписувала статус, який інший адмін встиг змінити (запланований пост ставав чернеткою). Тепер публікація пишеться лише якщо змінюється (`isSamePublication`); лишається last-writer-wins для двох **одночасних змін статусу** — прийнятно. Перевірено підміною застарілого читання; контрольний прогін без фіксу → `DRAFT`, дата `null`
- [x] **413 на валідному пості:** межа контенту 100 000 символів проти дефолтних 100 KB тіла Express — UA-переклад максимальної довжини (≈ 200 KB) не зберігався. `JSON_BODY_LIMIT = '1mb'` (`app.constants.ts`, `app.setup.ts` — `useBodyParser`); > 1 MB → 413
- [x] **`?page=1e20` → 500** (`skip` не влазить в int64) → `@Max(100 000)` → 400
- [x] Спрощено: суфікс slug-а — `randomBytes(3)` → hex замість `BigInt` → base36
- Перевірено й **без проблем:** лайки — і `GET stats`, і `toggle` йдуть через `assertPostExists` (правило видимості покриває обидва); web SSR ходить з `cache: 'no-store'` (знятий з публікації пост зникає одразу); тіло-масив / `translations: [null]` / `"x"` / порожнє тіло → 400; `status: null` → DRAFT; старих полів (`published`, `coverImage`, `translations`, `getTranslation`) у web / admin / types не лишилось; регресія переходів DRAFT ⇄ PUBLISHED ⇄ ARCHIVED → SCHEDULED, backdating, колізія slug — ✅
- [x] `tsc` API: **35** (posts, languages, app — 0); jest 54/54; `eslint` чистий; тестові дані прибрано
- Відоме, не виправляємо: EN-заголовок без латиниці (кирилицею) → slug `post` / `post-<hex>` (деградація, не помилка); `generateMetadata` для неіснуючого поста дає title «Не вдалося завантажити пост» на сторінці 404 (косметика)
