import type { ApiCache } from './http';

/*
 * Публічні дані API в кеші даних Next (M1.8.3): тег — що оновлює вебхук API (`/api/revalidate`, правило —
 * `lib/revalidate/content-event-tags.ts`), TTL — страховка, якщо вебхук не дійшов (рестарт API, мережа). Сюди — лише
 * відповіді, однакові для всіх читачів; персональне (`/auth/me`, коментарі з `myReaction`) — `private`.
 */

const FIVE_MINUTES_S = 5 * 60;
const ONE_HOUR_S = 60 * 60;

export const HOME_CACHE_TAG = 'home';
export const NEWS_FEED_CACHE_TAG = 'posts:feed';
export const SITEMAP_INDEX_CACHE_TAG = 'sitemap:index';
/** Усі місяці разом: подія новини не несе дати публікації, тож місяць новини сайт не знає. */
export const SITEMAP_MONTHS_CACHE_TAG = 'sitemap:months';
export const SITEMAP_NEWS_CACHE_TAG = 'sitemap:news';

/** Тег новини — за номером: сторінка знає з адреси `{slug}-{number}` лише його, і він же є в події. */
export function postCacheTag(postNumber: number): string {
  return `post:${postNumber}`;
}

function publicCache(tag: string, revalidate: number): ApiCache {
  return { cache: 'public', tags: [tag], revalidate };
}

export const HOME_NEWS_CACHE = publicCache(HOME_CACHE_TAG, FIVE_MINUTES_S);
export const NEWS_FEED_CACHE = publicCache(NEWS_FEED_CACHE_TAG, FIVE_MINUTES_S);
export const SITEMAP_INDEX_CACHE = publicCache(
  SITEMAP_INDEX_CACHE_TAG,
  ONE_HOUR_S,
);
export const SITEMAP_MONTH_CACHE = publicCache(
  SITEMAP_MONTHS_CACHE_TAG,
  ONE_HOUR_S,
);
export const SITEMAP_NEWS_CACHE = publicCache(
  SITEMAP_NEWS_CACHE_TAG,
  FIVE_MINUTES_S,
);

export function postDetailCache(postNumber: number): ApiCache {
  return publicCache(postCacheTag(postNumber), ONE_HOUR_S);
}
