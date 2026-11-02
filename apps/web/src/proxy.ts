import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { isSiteIndexingEnabled } from '@/lib/env/server-env-schema';

const runIntl = createIntlMiddleware(routing);

/**
 * Старий сегмент української `/ua/…` → `/uk/…` (D22): закладки й посилання не ламаються.
 * Без урахування регістру — як next-intl (`/EN` → `/en`), тож `/UA/…` теж колись працювало.
 * Тимчасово — прибрати перед продом (M3.1).
 */
const LEGACY_UKRAINIAN_PREFIX = /^\/ua(?=\/|$)/i;

/** Сайт закритий від індексації (M1.8.3): тест-сервер, `SITE_INDEXING` ≠ `true`. */
const NOINDEX_HEADER = 'noindex, nofollow';

/**
 * Next.js 16: `middleware.ts` замінено на `proxy.ts` (див. документацію Next); працює в Node, тож `SITE_INDEXING`
 * читає під час запиту, а не збірки. React 19 + next-intl: та сама логіка інтернаціоналізації, інша точка входу.
 */
export default function proxy(request: NextRequest) {
  const response = routeByLocale(request);
  if (!isSiteIndexingEnabled(process.env)) {
    response.headers.set('X-Robots-Tag', NOINDEX_HEADER);
  }
  return response;
}

function routeByLocale(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (LEGACY_UKRAINIAN_PREFIX.test(pathname)) {
    // `clone()` зберігає query (`?league=`, `?date=`)
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace(LEGACY_UKRAINIAN_PREFIX, '/uk');
    return NextResponse.redirect(redirectUrl, 308);
  }
  return runIntl(request);
}

/**
 * Proxy — лише для сторінок (M1.8.3): без `/api/` (вебхук, без мови), статики й оптимізатора картинок Next і файлів з
 * розширенням (`/sitemap.xml`, `/sitemaps/posts-2026-10.xml`, `/robots.txt`, `/favicon.ico`) — інакше next-intl
 * дописав би їм мову. Перелік адрес — `proxy.test.ts`.
 */
export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
