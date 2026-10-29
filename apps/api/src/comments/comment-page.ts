import type { Prisma } from '@prisma/client';
import type { CommentPageOrder, CommentPagePosition } from './comment-cursor';

/** Порядок коренів, який вибирає клієнт (`?sort=`). Зараз лише «Нові»; «Популярні» — M2 (D27). */
export const COMMENT_ROOT_SORTS = ['newest'] as const;
export type CommentRootSort = (typeof COMMENT_ROOT_SORTS)[number];

/** Порції за замовчуванням (D27): коренів — 20, відповідей гілки — 10. */
export const COMMENT_ROOTS_PAGE_LIMIT = 20;
export const COMMENT_REPLIES_PAGE_LIMIT = 10;

/**
 * Порядок рядків порції: час, а за рівного часу — `id` (cuid унікальний), тож порядок повний і курсор
 * однозначний навіть для коментарів однієї мілісекунди.
 */
export function commentPageOrderBy(
  order: CommentPageOrder,
): Prisma.CommentOrderByWithRelationInput[] {
  const direction = order === 'newest' ? 'desc' : 'asc';
  return [{ createdAt: direction }, { id: direction }];
}

/**
 * Рядки після позиції в порядку порції (keyset). `createdAt ≤ / ≥` — межа діапазону для індексу, решта —
 * розв'язання рівного часу за `id`: `(createdAt, id) < (позиція)` для «нових першими», `>` — для «старих першими».
 */
export function commentsAfterPositionWhere(
  order: CommentPageOrder,
  position: CommentPagePosition,
): Prisma.CommentWhereInput {
  if (order === 'newest') {
    return {
      createdAt: { lte: position.createdAt },
      OR: [
        { createdAt: { lt: position.createdAt } },
        { id: { lt: position.id } },
      ],
    };
  }
  return {
    createdAt: { gte: position.createdAt },
    OR: [
      { createdAt: { gt: position.createdAt } },
      { id: { gt: position.id } },
    ],
  };
}

/**
 * Порцію читаємо з одним зайвим рядком: він є — є й наступна порція, а її курсор — позиція останнього
 * виданого рядка (не зайвого: той прийде першим у наступній).
 */
export function splitCommentPage<Row extends CommentPagePosition>(
  rowsWithExtra: Row[],
  limit: number,
): { pageRows: Row[]; nextPosition: CommentPagePosition | null } {
  if (rowsWithExtra.length <= limit) {
    return { pageRows: rowsWithExtra, nextPosition: null };
  }
  const pageRows = rowsWithExtra.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];
  return {
    pageRows,
    nextPosition: { createdAt: lastRow.createdAt, id: lastRow.id },
  };
}
