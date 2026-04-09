import { NextRequest } from 'next/server';

/**
 * Браузери часто шлють `uk` для української, а у URL/API ми використовуємо `ua`.
 * Додаємо `ua` до Accept-Language, щоб next-intl міг обрати локаль `ua`.
 */
export function withUaLocaleAlias(request: NextRequest): NextRequest {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) {
    return request;
  }
  const hasUa = /\bua\b/i.test(acceptLanguage);
  const hasEn = /\ben\b/i.test(acceptLanguage);
  if (hasUa || !hasEn) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set(
    'accept-language',
    `${acceptLanguage}, ua;q=0.99`,
  );

  return new NextRequest(request.url, {
    headers,
    method: request.method,
  });
}
