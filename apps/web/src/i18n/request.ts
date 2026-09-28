import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing, type AppLocale } from './routing';
import { resolveTimeZone, TIME_ZONE_COOKIE } from './time-zone';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const resolvedLocale: AppLocale =
    requested && routing.locales.includes(requested as AppLocale)
      ? (requested as AppLocale)
      : routing.defaultLocale;
  const cookieStore = await cookies();

  return {
    locale: resolvedLocale,
    // Один пояс для SSR і клієнта: `NextIntlClientProvider` успадковує його з сервера
    timeZone: resolveTimeZone(cookieStore.get(TIME_ZONE_COOKIE)?.value),
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  };
});
