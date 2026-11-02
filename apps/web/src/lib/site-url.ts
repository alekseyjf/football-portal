import 'server-only';
import { serverEnv } from '@/lib/env/server-env';
import { absoluteUrl } from '@/lib/seo/page-metadata';

/**
 * Адреса самого сайту (`SITE_URL`, origin без `/` у кінці) — лише на сервері: повні адреси JSON-LD, а клієнтському
 * тексту новини її передає сторінка пропом (своє посилання — у тій самій вкладці).
 */
export function siteUrl(): string {
  return serverEnv().SITE_URL;
}

/** Шлях сторінки (`/uk/news`) → повна адреса на сайті. */
export function absoluteSiteUrl(pathname: string): string {
  return absoluteUrl(siteUrl(), pathname);
}
