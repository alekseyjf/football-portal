import type { MetadataRoute } from 'next';

/**
 * `robots.txt` (M1.8.3): закритий сайт (тест-сервер, `SITE_INDEXING` ≠ `true`) — `Disallow: /`; відкритий — усе
 * дозволено й лише `Sitemap:` з повною адресою index (Google News sitemap — у ньому).
 */
export function robotsRules(site: {
  isIndexed: boolean;
  sitemapUrl: string;
}): MetadataRoute.Robots {
  if (!site.isIndexed) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/' }, sitemap: site.sitemapUrl };
}
