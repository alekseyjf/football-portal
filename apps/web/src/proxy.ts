import {
  basicAuthChallenge,
  basicAuthGate,
  isBasicAuthorized,
} from '@football-portal/validation/site-gateway';
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

/** Шлюз до API (`app/api/[...path]`, D59) і Swagger на тесті: без мови в адресі. */
const API_PATH_PREFIX = '/api/';

/**
 * Next.js 16: `middleware.ts` замінено на `proxy.ts` (див. документацію Next); працює в Node, тож `SITE_INDEXING` і
 * пароль тест-сервера читає під час запиту, а не збірки. React 19 + next-intl: та сама логіка інтернаціоналізації, інша
 * точка входу.
 */
export default function proxy(request: NextRequest): Response {
  const accessDenied = denyWithoutPassword(request);
  if (accessDenied) return accessDenied;
  const response = request.nextUrl.pathname.startsWith(API_PATH_PREFIX)
    ? NextResponse.next()
    : routeByLocale(request);
  if (!isSiteIndexingEnabled(process.env)) {
    response.headers.set('X-Robots-Tag', NOINDEX_HEADER);
  }
  return response;
}

/**
 * Тест-сервер закритий спільним паролем (M1.11.6, 👤 У21): Basic Auth на сторінках і шлюзі до API — Password Protection
 * Vercel лише на Pro (D58). `APP_ENV` ≠ `test` — без пароля; невалідні змінні тесту — не пускає нікого.
 */
function denyWithoutPassword(request: NextRequest): Response | null {
  const gate = basicAuthGate(process.env);
  if (!gate.isRequired) return null;
  const authorization = request.headers.get('authorization');
  return isBasicAuthorized(authorization, gate.credentials)
    ? null
    : basicAuthChallenge();
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
 * Proxy — сторінки й шлюз до API `/api/*` (пароль тесту, M1.11.6). Повз нього: вебхук API `/api/revalidate` (свій підпис,
 * D57), статика й оптимізатор картинок Next, файли з розширенням (`/sitemap.xml`, `/sitemaps/posts-2026-10.xml`,
 * `/robots.txt`, `/favicon.ico`, статика Swagger) — інакше next-intl дописав би їм мову, а пошуковик не прочитав би
 * `robots.txt`. Перелік адрес — `proxy.test.ts`.
 */
export const config = {
  matcher: [
    '/((?!api/revalidate|_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
