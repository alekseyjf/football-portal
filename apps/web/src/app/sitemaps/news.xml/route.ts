import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { serverEnv } from '@/lib/env/server-env';
import { fetchNewsSitemap } from '@/lib/seo/sitemap-api';
import { newsSitemapUrls } from '@/lib/seo/sitemap-entries';
import {
  newsSitemapXml,
  sitemapNotFound,
  xmlResponse,
} from '@/lib/seo/sitemap-xml';
import { siteUrl } from '@/lib/site-url';

/** Назва видання кожною мовою — та сама, що `og:site_name` і видавець у JSON-LD. */
async function publicationNames(): Promise<Record<AppLocale, string>> {
  const names = await Promise.all(
    routing.locales.map(async (locale) => {
      const tMeta = await getTranslations({ locale, namespace: 'meta' });
      return [locale, tMeta('title')] as const;
    }),
  );
  return Object.fromEntries(names) as Record<AppLocale, string>;
}

/** Google News sitemap (M1.8.3, D57): новини за 48 год. Сайт закритий — 404. */
export async function GET() {
  await connection();
  if (!serverEnv().SITE_INDEXING) return sitemapNotFound();
  const [sitemap, names] = await Promise.all([
    fetchNewsSitemap(),
    publicationNames(),
  ]);
  return xmlResponse(
    newsSitemapXml(newsSitemapUrls(siteUrl(), sitemap, names)),
  );
}
