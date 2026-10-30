# D34 — SEO багатомовного сайту

- **Статус:** ✅ прийнято · 2026-10-08 · 👤 рішення власника (11.1, 11.4) + ⭐ деталі · уточнено 2026-10-30 (бриф M1.8, нижче) · ✅ M1.8.1
- **Етап:** M1.8 (M1.8.1 метадані ✅, M1.8.2 sitemap і robots, M1.8.3 структуровані дані й замір); далі M2.2 (`SportsEvent`), M2.9 (OG-картинки), M3.7

## Контекст
SEO — пріоритет (👤 11.1): для новинного сайту Google — головне джерело трафіку.

## Рішення
- 👤 Кожна мовна версія має свій `canonical`; `hreflang` — `en`, `uk` + `x-default` → EN. `<html lang>` — `en` / `uk` ([D22](D22-ukrainian-language-code.md)).
- ⭐ Сторінка без перекладу: `canonical` → EN-версія, у `hreflang` — лише наявні мови ([D23](D23-content-languages.md)).
- ⭐ `sitemap.ts`: новини, теги, статичні сторінки; `lastmod` — з `PostTranslation.updatedAt`, бо `Post.updatedAt` змінюється від лайків.
- 👤 `robots.ts` за середовищем: тест — `Disallow: /`, прод — дозволено + посилання на sitemap.
- ⭐ JSON-LD: `NewsArticle` (headline, дати, author, image, publisher + logo, `inLanguage`, `isBasedOn` — джерела) + `BreadcrumbList`; `SportsEvent` для матчів (M2.2) — умова розширених результатів Google.
- ⭐ Сторінки входу й реєстрації — `noindex`.
- ⭐ Базові Open Graph / Twitter-теги з обкладинки — разом з metadata (M1.8); 👤 згенеровані OG-картинки — після тестового релізу (M2.9).
- ⭐ Перед продом: Google Search Console, Google News sitemap, Core Web Vitals у нормі (M3.7).
- 👤 Тест-сервер закритий від індексації ([D31](D31-test-environment.md)).

## Уточнення — бриф M1.8 (👤 2026-10-30)

### M1.8.1 Метадані сторінок ✅
- 👤 Одна чиста функція `pageMetadata` (`apps/web/src/lib/seo/page-metadata.ts`, unit) — canonical, `hreflang` (`en`, `uk`, `x-default` → EN), `noindex`, Open Graph (`og:url` = canonical, `og:locale` + `og:locale:alternate`, `og:site_name`), картка X; `postMetadata` — поверх неї. Адреси — шляхи, повні робить `metadataBase` (`SITE_URL`).
- 👤 **Canonical нормалізований:** будує його сторінка з уже розібраних параметрів (`newsFeedHref`, `matchesPageHref`) — `utm_*`, `fbclid` і чужі параметри не потрапляють, порядок сталий, шляхи — малими літерами (slug з API; інший запис → 308). `hreflang` — лише мови з перекладом (`availableLanguages`).
- 👤 **Сторінка без перекладу** (`/uk/…` з англійським текстом): canonical → EN, у `hreflang` немає `uk`, **без `noindex`**, `og:locale` — мова тексту, у sitemap — ні, текст статті — з `lang="en"`.
- 👤 **Сторінки з параметрами — `noindex, follow` і canonical на себе**, не на сторінку без параметрів: `/news` з фільтрами (змінює [D52](D52-news-feed.md)), `/matches` з `?date=` / `?league=`. *Чому:* `noindex` разом з canonical на іншу адресу — суперечливі сигнали Google (він може перенести `noindex` на ціль). `hreflang` у таких сторінок немає. `?page=N` без фільтрів — в індексі (D52); головна з `?league=` — canonical на головну (параметр лише перемикає таблицю сайдбару). Вхід і реєстрація — `noindex, follow`.
- ⭐ next-intl `alternateLinks: false` — *чому:* інакше він шле HTTP-заголовок `Link` з `hreflang` на кожну сторінку — з `uk` для новини без перекладу й `x-default` на адресу без мови (перевірено на M1.8.1).
- 👤 Новина — `og:type=article`: `published_time`, `modified_time` (= дата публікації до OQ-26), `section` (рубрика картки), `tag` (теги). ⭐ `article:author` — ні: Open Graph чекає адресу профілю, а сторінок авторів немає.
- 👤 **Картка X — завжди `summary_large_image`**; без обкладинки — згенерована картка `next/og` (рубрика, назва, назва сайту; 1200 × 630): маршрути `/{locale}/og/page/…`, `/og/post/{number}`, `/og/match/{id}`, шрифт — Geist з кирилицею в репозиторії. Згенеровані OG-картинки «на повну» (матч з рахунком і емблемами, бренд) — M2.9.
- 👤 Шаблон назви — `%s | Назва сайту`. Окремі SEO-назва й опис новини (`seoTitle` / `seoDescription`, nullable) — [`backlog.md`](../backlog.md).
- ⭐ 404, а не 410, для знятої новини — *чому:* сторінка App Router віддає лише `notFound()`, а Google обробляє 404 і 410 майже однаково.

### M1.8.2 sitemap і robots
- 👤 Індексацію вмикає серверна змінна web `SITE_INDEXING` (за замовчуванням `false`) — *чому:* `NODE_ENV=production` і на тесті, і на проді; забута змінна закриває сайт, а не відкриває тест-сервер. Вона ж замінює для web `APP_ENV=test` з [D31](D31-test-environment.md) (API — свій прапорець, M1.11.4).
- 👤 `robots.ts` і `sitemap.ts` — динамічні (`force-dynamic`), змінна — лише серверна; вимкнено — `Disallow: /` і `X-Robots-Tag: noindex, nofollow` з `proxy.ts`, увімкнено — sitemap у `robots.txt` і глобально `max-image-preview:large`.
- 👤 sitemap index з нарізкою за місяцями (`generateSitemaps`), маршрут API з `?month=`; кеш + `revalidateTag` при публікації; `hreflang` у sitemap — лише наявні переклади. **Slug один на всі мови** ([D24](D24-news-url-slug-number.md)) — адреси новини різняться лише мовою.
- 👤 Матчі в sitemap — разом із `SportsEvent` (M2.2). ⭐ Google News sitemap (48 год, ≤ 1000) — у M3.7, з Search Console: закритий тест-сервер Google News не читає.

### M1.8.3 Структуровані дані й замір
- 👤 Типи JSON-LD — `schema-dts`. `VideoObject` — ні, поки немає дати завантаження відео (YouTube Data API — [`backlog.md`](../backlog.md)).
- 👤 Rich Results Test — у режимі «Код» на HTML локальної збірки; Lighthouse — `next build && next start`, мобільний профіль; повторно — на тест-сервері (M1.11). Пороги: **SEO = 100**, Best Practices ≥ 90; LCP < 2,5 с і CLS < 0,1 — ціль. Lighthouse CI — конфіг у M1.8.3, job у GitHub Actions — M1.10.1.
- 👤 Після запуску прод-домену — Search Console і Bing Webmaster Tools, IndexNow, RSS ([`backlog.md`](../backlog.md), M3.7).
