import { Injectable } from '@nestjs/common';
import { LikeType, Prisma } from '@prisma/client';
import type { PublicPostScope } from '../posts/post-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import type { CommentPageOrder, CommentPagePosition } from './comment-cursor';
import { commentPageOrderBy, commentsAfterPositionWhere } from './comment-page';
import { listedRootWhere, publicThreadWhere } from './comment-visibility';

/** Коментар порції (D27); заглушку (`deletedAt`) ховає `toCommentItem`. */
const COMMENT_ITEM_SELECT = {
  id: true,
  parentId: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  editedAt: true,
  likeCount: true,
  replyCount: true,
  replyToCommentId: true,
  author: { select: PUBLIC_AUTHOR_SELECT },
  replyToUser: { select: PUBLIC_AUTHOR_SELECT },
} satisfies Prisma.CommentSelect;

export type CommentItemRow = Prisma.CommentGetPayload<{
  select: typeof COMMENT_ITEM_SELECT;
}>;

const MODERATION_SELECT = {
  id: true,
  authorId: true,
  threadId: true,
  parentId: true,
  rootId: true,
  deletedAt: true,
} satisfies Prisma.CommentSelect;

/** Стан коментаря для відповіді на нього й модерації; `parentId` / `rootId` / `threadId` незмінні. */
export type CommentModerationRow = Prisma.CommentGetPayload<{
  select: typeof MODERATION_SELECT;
}>;

/** Стан заблокованого рядка (`lockForWrite`). */
export type LockedComment = { id: string; deletedAt: Date | null };

/** Корінь (`branch: null`) або відповідь у гілці кореня з адресатом (D27). */
export type NewCommentRow = {
  threadId: string;
  authorId: string;
  content: string;
  branch: {
    rootId: string;
    replyToCommentId: string | null;
    replyToUserId: string | null;
  } | null;
};

/** Порція: `take` — з одним зайвим рядком (`splitCommentPage`). */
export type CommentPageQuery = {
  position: CommentPagePosition | null;
  take: number;
};

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  /** Корені треду, нові першими: живі й заглушки з відповідями (D27). */
  findRootsPage(
    threadId: string,
    page: CommentPageQuery,
  ): Promise<CommentItemRow[]> {
    return this.findPage({ threadId, ...listedRootWhere() }, 'newest', page);
  }

  /** Корінь, чиї відповіді може читати публіка: у списку коренів (D27) і в публічному треді. */
  async existsListedRoot(
    rootId: string,
    scope: PublicPostScope,
  ): Promise<boolean> {
    const root = await this.prisma.comment.findFirst({
      where: {
        id: rootId,
        ...listedRootWhere(),
        thread: publicThreadWhere(scope),
      },
      select: { id: true },
    });
    return root !== null;
  }

  /** Живі відповіді гілки, від старих до нових. */
  findRepliesPage(
    rootId: string,
    page: CommentPageQuery,
  ): Promise<CommentItemRow[]> {
    return this.findPage({ rootId, deletedAt: null }, 'oldest', page);
  }

  /** Мої голоси за коментарі порції — одним запитом (D27, без N+1). */
  async findUserReactions(
    userId: string,
    commentIds: string[],
  ): Promise<Map<string, LikeType>> {
    if (commentIds.length === 0) return new Map();
    const likes = await this.prisma.commentLike.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true, type: true },
    });
    return new Map(likes.map((like) => [like.commentId, like.type]));
  }

  findForModeration(id: string): Promise<CommentModerationRow | null> {
    return this.prisma.comment.findUnique({
      where: { id },
      select: MODERATION_SELECT,
    });
  }

  insert(
    tx: Prisma.TransactionClient,
    newComment: NewCommentRow,
  ): Promise<CommentItemRow> {
    const { branch } = newComment;
    return tx.comment.create({
      data: {
        threadId: newComment.threadId,
        authorId: newComment.authorId,
        content: newComment.content,
        // Відповідь — завжди під коренем гілки (CHECK `Comment_single_level_check`)
        parentId: branch?.rootId ?? null,
        rootId: branch?.rootId ?? null,
        depth: branch ? 1 : 0,
        replyToCommentId: branch?.replyToCommentId ?? null,
        replyToUserId: branch?.replyToUserId ?? null,
      },
      select: COMMENT_ITEM_SELECT,
    });
  }

  /**
   * +1 відповідь кореню, поки гілка відкрита: корінь живий або заглушка з відповідями (D27) — відповідь на
   * відповідь під заглушкою продовжує розмову. `false` — корінь прибрали: відповідь не створюємо.
   */
  async incrementReplyCountIfBranchOpen(
    tx: Prisma.TransactionClient,
    rootId: string,
    threadId: string,
  ): Promise<boolean> {
    const { count } = await tx.comment.updateMany({
      where: { id: rootId, threadId, ...listedRootWhere() },
      data: { replyCount: { increment: 1 } },
    });
    return count === 1;
  }

  /**
   * `updateMany`, а не `update`: корінь, якого вже прибрав purge-thread, пропускаємо без P2025
   * (далі soft delete цілі все одно поверне 404). Рядок, якщо є, блокується до кінця транзакції.
   */
  async changeReplyCount(
    tx: Prisma.TransactionClient,
    commentId: string,
    delta: number,
  ): Promise<void> {
    await tx.comment.updateMany({
      where: { id: commentId },
      data: { replyCount: { increment: delta } },
    });
  }

  /**
   * Блокує рядки до кінця транзакції й повертає їхній актуальний стан (після очікування —
   * версію, закомічену суперником). Порядок — корінь перед відповідями (`depth`), як у
   * soft delete, тож вони не зациклюються. `FOR NO KEY UPDATE`, а не `FOR UPDATE`: не
   * конфліктує з FK-блокуванням (`KEY SHARE`), яке бере вставка відповіді на `rootId` / `parentId`,
   * інакше відповідь у гілці + purge її кореня давали deadlock.
   */
  lockForWrite(
    tx: Prisma.TransactionClient,
    commentIds: string[],
  ): Promise<LockedComment[]> {
    if (commentIds.length === 0) return Promise.resolve([]);
    return tx.$queryRaw<LockedComment[]>`
      SELECT "id", "deletedAt" FROM "Comment"
      WHERE "id" IN (${Prisma.join(commentIds)})
      ORDER BY "depth", "id"
      FOR NO KEY UPDATE`;
  }

  async softDeleteIfLive(
    tx: Prisma.TransactionClient,
    commentId: string,
    deletedAt: Date,
  ): Promise<boolean> {
    const { count } = await tx.comment.updateMany({
      where: { id: commentId, deletedAt: null },
      data: { deletedAt },
    });
    return count === 1;
  }

  /** Фізичне видалення без жодної відповіді, живої чи soft-видаленої (P4-6). */
  async purgeIfNoReplies(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<boolean> {
    const { count } = await tx.comment.deleteMany({
      where: { id: commentId, replies: { none: {} } },
    });
    return count === 1;
  }

  /** Усі відповіді гілки, і soft-видалені (purge-thread, P4-7). */
  async findReplyIds(
    tx: Prisma.TransactionClient,
    rootId: string,
  ): Promise<string[]> {
    const replies = await tx.comment.findMany({
      where: { rootId },
      select: { id: true },
    });
    return replies.map((reply) => reply.id);
  }

  async purgeByIds(
    tx: Prisma.TransactionClient,
    commentIds: string[],
  ): Promise<number> {
    if (commentIds.length === 0) return 0;
    const { count } = await tx.comment.deleteMany({
      where: { id: { in: commentIds } },
    });
    return count;
  }

  private findPage(
    listWhere: Prisma.CommentWhereInput,
    order: CommentPageOrder,
    page: CommentPageQuery,
  ): Promise<CommentItemRow[]> {
    const afterPosition = page.position
      ? commentsAfterPositionWhere(order, page.position)
      : {};
    return this.prisma.comment.findMany({
      // AND: і список, і межа курсора мають власний OR
      where: { AND: [listWhere, afterPosition] },
      orderBy: commentPageOrderBy(order),
      take: page.take,
      select: COMMENT_ITEM_SELECT,
    });
  }
}
