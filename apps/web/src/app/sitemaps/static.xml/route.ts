import { connection } from 'next/server';
import { serverEnv } from '@/lib/env/server-env';
import { staticSitemapUrls } from '@/lib/seo/sitemap-entries';
import { sitemapNotFound, urlSetXml, xmlResponse } from '@/lib/seo/sitemap-xml';
import { siteUrl } from '@/lib/site-url';

/** Головна, стрічка й матчі — обома мовами (M1.8.3). Сайт закритий — 404. */
export async function GET() {
  await connection();
  if (!serverEnv().SITE_INDEXING) return sitemapNotFound();
  return xmlResponse(urlSetXml(staticSitemapUrls(siteUrl())));
}
