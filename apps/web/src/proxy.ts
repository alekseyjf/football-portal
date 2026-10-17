import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const runIntl = createIntlMiddleware(routing);

/**
 * Старий сегмент української `/ua/…` → `/uk/…` (D22): закладки й посилання не ламаються.
 * Без урахування регістру — як next-intl (`/EN` → `/en`), тож `/UA/…` теж колись працювало.
 * Тимчасово — прибрати перед продом (M3.1).
 */
const LEGACY_UKRAINIAN_PREFIX = /^\/ua(?=\/|$)/i;

/**
 * Next.js 16: `middleware.ts` замінено на `proxy.ts` (див. документацію Next).
 * React 19 + next-intl: та сама логіка інтернаціоналізації, інша точка входу.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LEGACY_UKRAINIAN_PREFIX.test(pathname)) {
    // `clone()` зберігає query (`?league=`, `?date=`)
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace(LEGACY_UKRAINIAN_PREFIX, '/uk');
    return NextResponse.redirect(redirectUrl, 308);
  }
  return runIntl(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
