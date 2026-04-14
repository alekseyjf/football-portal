import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { normalizeAcceptLanguageForAppLocales } from '@/i18n/accept-language';
import { routing } from '@/i18n/routing';

const runIntl = createIntlMiddleware(routing);

/**
 * Next.js 16: `middleware.ts` замінено на `proxy.ts` (див. документацію Next).
 * React 19 + next-intl: та сама логіка інтернаціоналізації, інша точка входу.
 */
export default function proxy(request: NextRequest) {
  const normalizedRequest = normalizeAcceptLanguageForAppLocales(request);
  return runIntl(normalizedRequest);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
