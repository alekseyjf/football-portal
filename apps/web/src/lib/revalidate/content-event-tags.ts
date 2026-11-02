import {
  type ContentEvent,
  HOME_UPDATED_EVENT,
} from '@football-portal/validation/webhook';
import {
  HOME_CACHE_TAG,
  NEWS_FEED_CACHE_TAG,
  postCacheTag,
  SITEMAP_INDEX_CACHE_TAG,
  SITEMAP_MONTHS_CACHE_TAG,
  SITEMAP_NEWS_CACHE_TAG,
} from '@/lib/api/cache-tags';

/**
 * Які теги кешу оновлює подія API (M1.8.3, D57).
 * - `expireNow` — `revalidateTag(tag, { expire: 0 })`: сторінки для читачів — перший же запит після події бачить
 *   нове (з `'max'` перший відвідувач ще отримав би стару версію).
 * - `markStale` — `'max'`: sitemap-и — запит після події ще отримає стару версію, а нову Next вантажить у фоні;
 *   пошуковику секунди не важливі, а API не отримує сплеск запитів.
 */
export type EventCacheTags = {
  expireNow: string[];
  markStale: string[];
};

const SITEMAP_TAGS = [
  SITEMAP_INDEX_CACHE_TAG,
  SITEMAP_MONTHS_CACHE_TAG,
  SITEMAP_NEWS_CACHE_TAG,
];

/**
 * Новина з'явилась, змінилась чи зникла — сама новина, стрічка, головна (вона й серед найсвіжіших, і може бути
 * головною) і sitemap-и; закріплення головної — лише головна.
 */
export function cacheTagsForEvent(event: ContentEvent): EventCacheTags {
  if (event.event === HOME_UPDATED_EVENT) {
    return { expireNow: [HOME_CACHE_TAG], markStale: [] };
  }
  return {
    expireNow: [
      postCacheTag(event.post.number),
      NEWS_FEED_CACHE_TAG,
      HOME_CACHE_TAG,
    ],
    markStale: [...SITEMAP_TAGS],
  };
}
