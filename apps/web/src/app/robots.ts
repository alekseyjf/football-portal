import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { serverEnv } from '@/lib/env/server-env';
import { robotsRules } from '@/lib/seo/robots';
import { SITEMAP_INDEX_PATH } from '@/lib/seo/sitemap-entries';
import { absoluteSiteUrl } from '@/lib/site-url';

/** `robots.txt` — за `SITE_INDEXING` працюючого сервера (M1.8.3). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Без цього Next збирає `robots.txt` під час `next build` — зі змінними збірки, а не сервера
  await connection();
  return robotsRules({
    isIndexed: serverEnv().SITE_INDEXING,
    sitemapUrl: absoluteSiteUrl(SITEMAP_INDEX_PATH),
  });
}
