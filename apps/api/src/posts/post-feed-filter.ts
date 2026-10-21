import type { Prisma } from '@prisma/client';
import { splitSlugList } from '../common/validation/slug-list.decorator';

/** Фільтри стрічки `GET /posts` — slug-и через кому (формат перевірив `ListPostsQueryDto`); немає — без фільтра. */
export interface PostFeedFilters {
  tags?: string;
  competition?: string;
  club?: string;
}

/**
 * Умова фільтрів стрічки (D45, D46): усередині фільтра — «будь-який» (`?tags=a,b` — новини з тегом `a`
 * або `b`), між фільтрами — «і» (тег і турнір і клуб). Турнір — лише явна прив'язка новини, без клубів
 * ліги (D46). Невідомий slug нічого не знаходить — стрічка порожня, а не 400.
 */
export function postFeedFilterWhere(
  filters: PostFeedFilters,
): Prisma.PostWhereInput {
  const conditions: Prisma.PostWhereInput[] = [];
  if (filters.tags) {
    const slugs = splitSlugList(filters.tags);
    conditions.push({ tags: { some: { tag: { slug: { in: slugs } } } } });
  }
  if (filters.competition) {
    const slugs = splitSlugList(filters.competition);
    conditions.push({
      competitions: { some: { competition: { slug: { in: slugs } } } },
    });
  }
  if (filters.club) {
    const slugs = splitSlugList(filters.club);
    conditions.push({ clubs: { some: { club: { slug: { in: slugs } } } } });
  }
  return conditions.length ? { AND: conditions } : {};
}
