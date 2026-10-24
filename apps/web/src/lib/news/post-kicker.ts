import type { PostSummary } from '@/lib/api/types';
import {
  NO_NEWS_FEED_FILTERS,
  type NewsFeedFilters,
} from './news-feed-filters';

/** Рубрика картки новини: назва й фільтр стрічки, куди веде посилання. */
export type PostKicker = {
  name: string;
  filters: NewsFeedFilters;
};

/**
 * Рубрика над заголовком картки (M1.6.1): турнір, якщо в новини він один; інакше — перший тег за назвою мовою сторінки;
 * інакше — без рубрики. Посилання — стрічка лише з цим фільтром. Тимчасове правило: «головна тема» новини (`ideas.md`)
 * замінить його вибором редактора.
 */
export function postKicker(
  post: Pick<PostSummary, 'competitions' | 'tags'>,
  collator: Intl.Collator,
): PostKicker | null {
  if (post.competitions.length === 1) {
    const [competition] = post.competitions;
    return {
      name: competition.name,
      filters: { ...NO_NEWS_FEED_FILTERS, competition: competition.slug },
    };
  }
  const [firstTag] = [...post.tags].sort((leftTag, rightTag) =>
    collator.compare(leftTag.name, rightTag.name),
  );
  if (!firstTag) return null;
  return {
    name: firstTag.name,
    filters: { ...NO_NEWS_FEED_FILTERS, tags: [firstTag.slug] },
  };
}
