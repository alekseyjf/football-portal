import { serverEnv } from '@/lib/env/server-env';
import { fetchPostSitemap } from '@/lib/seo/sitemap-api';
import { postSitemapUrls, sitemapMonthOf } from '@/lib/seo/sitemap-entries';
import { sitemapNotFound, urlSetXml, xmlResponse } from '@/lib/seo/sitemap-xml';
import { siteUrl } from '@/lib/site-url';

type Context = { params: Promise<{ file: string }> };

/**
 * Новини місяця — `posts-YYYY-MM.xml` (M1.8.3): адреса кожною мовою перекладу з `hreflang`. Інша назва файла чи
 * сайт закритий — 404. `static.xml` і `news.xml` — свої маршрути (статичний сегмент перемагає цей).
 */
export async function GET(_request: Request, { params }: Context) {
  const month = sitemapMonthOf((await params).file);
  if (!serverEnv().SITE_INDEXING || !month) return sitemapNotFound();
  const sitemap = await fetchPostSitemap(month);
  return xmlResponse(urlSetXml(postSitemapUrls(siteUrl(), sitemap)));
}
