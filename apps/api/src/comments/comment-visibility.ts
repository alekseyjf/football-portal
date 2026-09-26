import type { Prisma } from '@prisma/client';
import { livePostWhere } from '../posts/post-visibility';

/**
 * Тред, який бачить публіка (P4-1): пост живий (P3-1) або тред матчу
 * (матч без soft delete; видалення матчу каскадно прибирає тред).
 */
export function visibleThreadWhere(now: Date): Prisma.CommentThreadWhereInput {
  return {
    OR: [{ post: livePostWhere(now) }, { matchId: { not: null } }],
  };
}

/** Коментар, який можна читати й лайкати (P4-8): не видалений і в видимому треді. */
export function visibleCommentWhere(now: Date): Prisma.CommentWhereInput {
  return { deletedAt: null, thread: visibleThreadWhere(now) };
}
