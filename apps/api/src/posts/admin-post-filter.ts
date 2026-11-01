import type { PostStatus, Prisma } from '@prisma/client';
import { containsIgnoringCase } from '../prisma/prisma-text-search';

/** Фільтри списку новин адмінки (формат перевірив `ListAdminPostsQueryDto`); немає — без фільтра. */
export interface AdminPostListFilters {
  status?: PostStatus;
  search?: string;
}

/**
 * Умова списку новин адмінки (M1.4.8): без видалених; статус — як у БД (з D57 запланована, чия дата настала, за
 * хвилину стає PUBLISHED сама — особливого випадку «вже на сайті, а в БД SCHEDULED» з D47 немає); пошук — частина
 * заголовка будь-якою мовою, без урахування регістру (`%` і `_` — як текст). Фільтри разом — «і».
 */
export function adminPostListWhere(
  filters: AdminPostListFilters,
): Prisma.PostWhereInput {
  const conditions: Prisma.PostWhereInput[] = [{ deletedAt: null }];
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.search) {
    conditions.push({
      translations: { some: { title: containsIgnoringCase(filters.search) } },
    });
  }
  return { AND: conditions };
}
