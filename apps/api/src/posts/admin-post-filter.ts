import { PostStatus, type Prisma } from '@prisma/client';
import { containsIgnoringCase } from '../prisma/prisma-text-search';
import { livePostWhere } from './post-visibility';

/** Фільтри списку новин адмінки (формат перевірив `ListAdminPostsQueryDto`); немає — без фільтра. */
export interface AdminPostListFilters {
  status?: PostStatus;
  search?: string;
}

/**
 * Статус, як його бачить редактор (`isLive` і підпис статусу в адмінці): запланована новина, чия дата настала,
 * уже на сайті — вона серед PUBLISHED, а не SCHEDULED (cron-а немає, статус у БД лишається SCHEDULED, P3-1).
 * Кожна новина потрапляє рівно в один статус: дата в PUBLISHED / SCHEDULED є завжди (CHECK `Post_published_has_date_check`).
 */
function statusAsSeenByEditorWhere(
  status: PostStatus,
  now: Date,
): Prisma.PostWhereInput {
  switch (status) {
    case PostStatus.PUBLISHED:
      // «На сайті» — те саме правило, що й `isLive` (`livePostWhere`)
      return { OR: [{ status: PostStatus.PUBLISHED }, livePostWhere(now)] };
    case PostStatus.SCHEDULED:
      // Доповнення до `livePostWhere`: дата ще не настала
      return { status: PostStatus.SCHEDULED, publishedAt: { gt: now } };
    case PostStatus.DRAFT:
    case PostStatus.ARCHIVED:
      return { status };
  }
}

/**
 * Умова списку новин адмінки (M1.4.8): без видалених; статус — як бачить редактор; пошук — частина заголовка
 * будь-якою мовою, без урахування регістру (`%` і `_` — як текст). Фільтри разом — «і».
 */
export function adminPostListWhere(
  filters: AdminPostListFilters,
  now: Date,
): Prisma.PostWhereInput {
  const conditions: Prisma.PostWhereInput[] = [{ deletedAt: null }];
  if (filters.status) {
    conditions.push(statusAsSeenByEditorWhere(filters.status, now));
  }
  if (filters.search) {
    conditions.push({
      translations: { some: { title: containsIgnoringCase(filters.search) } },
    });
  }
  return { AND: conditions };
}
