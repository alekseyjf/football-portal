import type { Prisma } from '@prisma/client';
import {
  livePostWhere,
  publicPostWhere,
  type PublicPostScope,
} from '../posts/post-visibility';

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

/**
 * Тред порцій коментарів (D27): пост — як у стрічці й новині (`publicPostWhere`, P3-5), матч — будь-який.
 */
export function publicThreadWhere(
  scope: PublicPostScope,
): Prisma.CommentThreadWhereInput {
  return {
    OR: [{ post: publicPostWhere(scope) }, { matchId: { not: null } }],
  };
}

/**
 * Корінь у списку (D27): живий або заглушка «Коментар видалено» — видалений, поки під ним є живі відповіді.
 * Заглушка — похідний стан: видалили останню відповідь — зникає й вона.
 */
export function listedRootWhere(): Prisma.CommentWhereInput {
  return {
    parentId: null,
    OR: [{ deletedAt: null }, { replyCount: { gt: 0 } }],
  };
}
