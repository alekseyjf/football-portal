import { connection } from 'next/server';
import { serverEnv } from '@/lib/env/server-env';
import { fetchSitemapIndex } from '@/lib/seo/sitemap-api';
import { sitemapIndexEntries } from '@/lib/seo/sitemap-entries';
import {
  sitemapIndexXml,
  sitemapNotFound,
  xmlResponse,
} from '@/lib/seo/sitemap-xml';
import { siteUrl } from '@/lib/site-url';

/**
 * Sitemap index (M1.8.3): статичні сторінки, Google News і місяці новин. Route handler, а не `app/sitemap.ts`:
 * index Next сам не будує. Сайт закритий (`SITE_INDEXING` ≠ `true`) — 404.
 *
 * `connection()` у кожному маршруті sitemap: без request-time API `next build` пререндерить `GET` у статичний файл —
 * зі змінними збірки, а не сервера. Кешуються лише дані API (теги, `cache-tags.ts`).
 */
export async function GET() {
  await connection();
  if (!serverEnv().SITE_INDEXING) return sitemapNotFound();
  const index = await fetchSitemapIndex();
  return xmlResponse(sitemapIndexXml(sitemapIndexEntries(siteUrl(), index)));
}
