import type { ApiSchemas } from '../api-schemas';

/** `GET /posts/sitemap` — місяці з новинами (UTC, новіші першими): файли sitemap сайту (D57). */
export type PostSitemapIndex = ApiSchemas['PostSitemapIndexDto'];

/** `GET /posts/sitemap/{month}` — адреси новин місяця: кожен переклад — адреса, між ними `hreflang`. */
export type PostSitemap = ApiSchemas['PostSitemapDto'];

/** `GET /posts/sitemap/news` — новини за 48 год для Google News sitemap: заголовок кожною мовою. */
export type NewsSitemap = ApiSchemas['NewsSitemapDto'];
