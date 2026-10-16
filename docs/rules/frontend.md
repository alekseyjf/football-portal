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
// /en/news/[slug]
// /ua/news/[slug]
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
// інші збої — рендер без кешу, клієнт зробить refetch (news/[slug], matches/[id])
// generateMetadata і сторінка читають ту саму сутність → одна функція в React cache(), без двох запитів до API
//   (matches/[id]: const getMatchDetail = cache(fetchMatchDetail))
// 404 (з 2026-09-28) — ОДНА загальна app/not-found.tsx: свій <html>/<body> (кореневий layout повертає лише children),
//   мова — getLocale() next-intl, без навбару; [locale]/not-found і catch-all [...rest] свідомо НЕ робимо.
//   Невідомий URL → /_not-found, повний SSR; кинутий notFound() сторінки → у Next 16 SSR-HTML — оболонка
//   __next_error__, 404 малює клієнт (так і в мінімальному стандартному застосунку — поведінка фреймворку);
//   статус 404 і noindex — є. Посилання на ще не існуючі сторінки — prefetch={false}: prefetch 404-маршруту
//   в Chrome лишається «незавершеним» (клієнт Next не дочитує тіло) → networkidle ніколи не настає
```

> ⭐ **Зміна до Rule 6** (після M1.2): українська — `/uk/…`, не `/ua/…` ([D22](../decisions/D22-ukrainian-language-code.md)).

---

## ⭐ Нові правила (2026-10-08)

**Rule 9 — Текст новин — лише через спільний Markdown-рендерер** ([D25](../decisions/D25-markdown-content.md))
```typescript
// ✅ <MarkdownContent source={post.content} />  — packages/ui, той самий у web і в прев'ю адмінки
// ❌ dangerouslySetInnerHTML, власний парсер, рендер сирого HTML
```

**Rule 10 — Кожна нова сторінка проходить Definition of Done** (`docs/football-plan.md`, розділ 8): 320 / 768 / 1280 px, `generateMetadata`, 404, скелетон, обидві мови, дати через спільний форматер, базова доступність.

**Rule 11 — Посилань на ще не існуючі сторінки немає** — пункт меню з'являється разом зі сторінкою (замість `prefetch={false}` на посиланні в 404).

**Rule 12 — Спільний UI web і admin** — у `packages/ui` (Markdown-рендерер, базові компоненти). Копіювати компонент між застосунками — ні.

**Rule 13 — Сторінка з даними має `error.tsx`** — зрозуміле повідомлення й «Спробувати ще», коли API недоступне.

**Rule 14 — SEO-метадані будує одна функція** — canonical, hreflang (`en`, `uk`, `x-default`), Open Graph — зі спільного хелпера, не вручну на кожній сторінці ([D34](../decisions/D34-seo-multilingual.md)).
