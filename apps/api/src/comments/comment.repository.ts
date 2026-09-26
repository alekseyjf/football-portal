import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_AUTHOR_SELECT } from '../users/public-author';
import type { BranchComment } from './comment-subtree';

export const COMMENT_NODE_SELECT = {
  id: true,
  content: true,
  pinnedAt: true,
  createdAt: true,
  parentId: true,
  author: { select: PUBLIC_AUTHOR_SELECT },
} satisfies Prisma.CommentSelect;

export type CommentNodeRow = Prisma.CommentGetPayload<{
  select: typeof COMMENT_NODE_SELECT;
}>;

const MODERATION_SELECT = {
  id: true,
  authorId: true,
  threadId: true,
  parentId: true,
  rootId: true,
  depth: true,
  deletedAt: true,
} satisfies Prisma.CommentSelect;

/** Стан коментаря для відповіді на нього й модерації; `parentId` / `rootId` / `threadId` незмінні. */
export type CommentModerationRow = Prisma.CommentGetPayload<{
  select: typeof MODERATION_SELECT;
}>;

/** Стан заблокованого рядка (`lockForWrite`). */
export type LockedComment = { id: string; deletedAt: Date | null };

export type NewCommentRow = {
  threadId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
};

@Injectable()
export class CommentRepository {
  constructor(private prisma: PrismaService) {}

  findLiveInThread(threadId: string): Promise<CommentNodeRow[]> {
    return this.prisma.comment.findMany({
      where: { threadId, deletedAt: null },
      select: COMMENT_NODE_SELECT,
    });
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
  ): Promise<CommentNodeRow> {
    return tx.comment.create({
      data: newComment,
      select: COMMENT_NODE_SELECT,
    });
  }

  /**
   * +1 відповідь батькові, лише якщо він живий і в тому ж треді (P4-2).
   * `false` — батька встигли видалити: відповідь не створюємо.
   */
  async incrementReplyCountIfLive(
    tx: Prisma.TransactionClient,
    parentId: string,
    threadId: string,
  ): Promise<boolean> {
    const { count } = await tx.comment.updateMany({
      where: { id: parentId, threadId, deletedAt: null },
      data: { replyCount: { increment: 1 } },
    });
    return count === 1;
  }

  /**
   * `updateMany`, а не `update`: батька, якого вже прибрав purge-thread, пропускаємо без P2025
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
   * версію, закомічену суперником). Порядок — від предків до нащадків (`depth`), як у
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

  /** Один рівень каскадного soft delete (P4-5): живі прямі відповіді на `parentIds`. */
  async softDeleteLiveRepliesOf(
    tx: Prisma.TransactionClient,
    parentIds: string[],
    deletedAt: Date,
  ): Promise<string[]> {
    const deletedReplies = await tx.comment.updateManyAndReturn({
      where: { parentId: { in: parentIds }, deletedAt: null },
      data: { deletedAt },
      select: { id: true },
    });
    return deletedReplies.map((reply) => reply.id);
  }

  /** Фізичне видалення без жодного дочірнього рядка, живого чи soft-видаленого (P4-6). */
  async purgeIfNoReplies(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<boolean> {
    const { count } = await tx.comment.deleteMany({
      where: { id: commentId, replies: { none: {} } },
    });
    return count === 1;
  }

  /** Уся гілка: корінь і всі рядки з `rootId = корінь` (P4-7). */
  findBranch(
    tx: Prisma.TransactionClient,
    branchRootId: string,
  ): Promise<BranchComment[]> {
    return tx.comment.findMany({
      where: { OR: [{ id: branchRootId }, { rootId: branchRootId }] },
      select: { id: true, parentId: true, depth: true },
    });
  }

  async purgeByIds(
    tx: Prisma.TransactionClient,
    commentIds: string[],
  ): Promise<number> {
    const { count } = await tx.comment.deleteMany({
      where: { id: { in: commentIds } },
    });
    return count;
  }
}
