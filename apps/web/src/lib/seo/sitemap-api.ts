import 'server-only';
import {
  SITEMAP_INDEX_CACHE,
  SITEMAP_MONTH_CACHE,
  SITEMAP_NEWS_CACHE,
} from '@/lib/api/cache-tags';
import { apiGet } from '@/lib/api/http';
import type {
  NewsSitemap,
  PostSitemap,
  PostSitemapIndex,
} from '@/lib/api/types';

/** Дані sitemap з API (D57) — з кешу даних Next; оновлює їх подія новини (`'max'`) або TTL. */
export function fetchSitemapIndex(): Promise<PostSitemapIndex> {
  return apiGet<PostSitemapIndex>('/posts/sitemap', SITEMAP_INDEX_CACHE);
}

/** `month` — уже перевірений `YYYY-MM` (`sitemapMonthOf`). */
export function fetchPostSitemap(month: string): Promise<PostSitemap> {
  return apiGet<PostSitemap>(`/posts/sitemap/${month}`, SITEMAP_MONTH_CACHE);
}

export function fetchNewsSitemap(): Promise<NewsSitemap> {
  return apiGet<NewsSitemap>('/posts/sitemap/news', SITEMAP_NEWS_CACHE);
}
