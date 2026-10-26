# Правила: frontend (Next.js, web і admin)

> Позначки: без позначки — чинне правило; ⭐ — нове або змінене 2026-10-08 (перечитай).

## ⚛️ Архітектурні правила (Frontend)

**Rule 1 — Server Component за замовчуванням**
```typescript
// Якщо немає useState/useEffect/onClick → Server Component
// "use client" тільки для інтерактивних компонентів
```

**Rule 2 — HTTP лише через `lib/api/http.ts`; дані в клієнті — через TanStack Query**
```typescript
// ✅ queryFn: () => apiGet('/posts') у useQuery / prefetchQuery
// ✅ мутації: apiPost / apiDelete у useMutation
// ✅ generateMetadata (RSC): apiGet напряму — без React Query
// ✅ Тип відповіді — згенерований: apiGet<PostDetail>(…), типи з `@/lib/api/types` (D28)
// ❌ fetch('http://localhost:4000/...') з хардкодом URL у компоненті
```

**Rule 3 — Компонент < 200 рядків**
```typescript
// Якщо більше → розбити на менші або винести логіку в хук
```

**Rule 4 — Логіка у хуки**
```typescript
// hooks/useComments.ts, hooks/useLikes.ts
// Компонент рендерить, хук думає
```

**Rule 5 — Форми через React Hook Form + Zod**
```typescript
// Zod схема → тип автоматично через z.infer<typeof schema>
// Ніяких useState для кожного поля форми
```

**Rule 6 — Locale передається через URL**
```typescript
// /en/news/{slug}-{number}
// /uk/news/{slug}-{number}  — код мови `uk` (не `ua` — це код країни), D22; slug один на всі мови (D24)
// next-intl у src/proxy.ts (Next 16 — proxy замість middleware) визначає мову
```

**Rule 7 — Дати лише через спільний форматер (з 2026-09-28)**
```typescript
// ✅ const formatDateTime = useDateTimeFormat();  formatDateTime(match.kickoffAt, { dateStyle: 'full', timeStyle: 'short' })
// ✅ RSC: formatDateTime(iso, locale, await getTimeZone(), options)  — lib/i18n/date-time.ts
// ❌ new Date(iso).toLocaleString(...)  — пояс процесу: SSR (UTC) ≠ браузер → hydration mismatch
// Пояс — next-intl (i18n/request.ts: cookie `tz` від TimeZoneSync, інакше Europe/Kyiv); день «сьогодні» / межі дня — у тому ж поясі
```

**Rule 8 — Сторінка з параметром у URL**
```typescript
// Сутність за slug / id → fetchQuery (не prefetchQuery — той ковтає помилки) + notFound() лише на 404 від API;
// інші збої — рендер без кешу, клієнт зробить refetch (news/[slugAndNumber], matches/[id])
// generateMetadata і сторінка читають ту саму сутність → одна функція в React cache(), без двох запитів до API
//   (matches/[id]: const getMatchDetail = cache(fetchMatchDetail))
// 404 (з 2026-09-28) — ОДНА загальна app/not-found.tsx: свій <html>/<body> (кореневий layout повертає лише children),
//   мова — getLocale() next-intl, без навбару; [locale]/not-found і catch-all [...rest] свідомо НЕ робимо.
//   Невідомий URL → /_not-found, повний SSR; кинутий notFound() сторінки → у Next 16 SSR-HTML — оболонка
//   __next_error__, 404 малює клієнт (так і в мінімальному стандартному застосунку — поведінка фреймворку);
//   статус 404 і noindex — є. Посилання на ще не існуючі сторінки — prefetch={false}: prefetch 404-маршруту
//   в Chrome лишається «незавершеним» (клієнт Next не дочитує тіло) → networkidle ніколи не настає
// ⭐ (2026-10-24, D52) Без loading.js над сторінкою, що кидає notFound() чи показує LCP-фото: loading.js вмикає стрімінг —
//   відповідь іде зі статусом 200 (лише noindex), а вміст лежить у прихованому блоці, доки React його не відкриє.
//   Відгук на перехід — useLinkStatus на натиснутому посиланні (components/layout/LinkPendingLabel)
```

> ⭐ **Зміна до Rule 6** (з M1.2): українська — `/uk/…`, не `/ua/…` ([D22](../decisions/D22-ukrainian-language-code.md)); старі `/ua/…` — 308 на `/uk/…` до M3.1.

---

## ⭐ Нові правила (2026-10-08)

**Rule 9 — Текст новин — лише через спільний Markdown-рендерер** ([D25](../decisions/D25-markdown-content.md))
```typescript
// ✅ <MarkdownContent source={post.content} />  — packages/ui, той самий у web і в прев'ю адмінки
// ❌ dangerouslySetInnerHTML, власний парсер, рендер сирого HTML
```

**Rule 10 — Кожна нова сторінка проходить Definition of Done** (`docs/football-plan.md`, розділ 8): 320 / 768 / 1280 px, `generateMetadata`, 404, скелетон, обидві мови, дати через спільний форматер, базова доступність.

**Rule 11 — Посилань на ще не існуючі сторінки немає** — пункт меню з'являється разом зі сторінкою (замість `prefetch={false}` на посиланні в 404).

**Rule 12 — Спільний UI web і admin** — у `packages/ui` (Markdown-рендерер, базові компоненти). Копіювати компонент між застосунками — ні. Пакет — без збірки ([D49](../decisions/D49-shared-ui-package.md)): новий застосунок-споживач додає його в `transpilePackages` і `@source` у `globals.css`; класи — лише Tailwind, вигляд тексту — `prose`.

**Rule 13 — Сторінка з даними має `error.tsx`** — зрозуміле повідомлення й «Спробувати ще», коли API недоступне.

**Rule 14 — SEO-метадані будує одна функція** — canonical, hreflang (`en`, `uk`, `x-default`), Open Graph — зі спільного хелпера, не вручну на кожній сторінці ([D34](../decisions/D34-seo-multilingual.md)).

> ⭐ **Доповнення до Rule 14** (2026-10-24, [D53](../decisions/D53-news-page.md)): структуровані дані (JSON-LD) — лише через `components/seo/JsonLd`:
> ```typescript
> // ✅ <JsonLd data={breadcrumbListJsonLd(items)} />  — React 19 пише текст <script> як є, `<` екранує serializeJsonLd
> // ❌ <script dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />  — так у документації Next, але в проєкті заборонено
> // Адреси в JSON-LD — повні: absoluteSiteUrl(pathname) з lib/site-url.ts (серверна SITE_URL)
> ```
>
> ⭐ **Змінні середовища web** (2026-10-25, [D53](../decisions/D53-news-page.md)): `NEXT_PUBLIC_*` — лише те, що потрібно браузеру (вбудовується при збірці); решта — серверні, через zod-схему `lib/env/server-env-schema.ts` (перевірка при старті — `instrumentation-node.ts`: Next збирає `instrumentation.ts` і для Edge, тож Node-код — лише в окремому файлі) і `serverEnv()` з `server-only`. Клієнтському компоненту серверне значення передає сторінка пропом:
> ```typescript
> // ✅ <NewsPostView siteUrl={siteUrl()} />  — у page.tsx (RSC)
> // ❌ process.env.SITE_URL у 'use client' — там його немає; NEXT_PUBLIC_ «щоб працювало» — зайве вбудовування
> ```
