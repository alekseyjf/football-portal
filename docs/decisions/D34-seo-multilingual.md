# D34 — SEO багатомовного сайту

- **Статус:** ✅ прийнято · 2026-10-08 · 👤 рішення власника (11.1, 11.4) + ⭐ деталі
- **Етап:** M1.8; далі M2.2 (`SportsEvent`), M2.9 (OG-картинки), M3.7

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
