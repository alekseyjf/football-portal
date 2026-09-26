import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { livePostWhere } from '../posts/post-visibility';
import { PrismaService } from '../prisma/prisma.service';

const THREAD_SELECT = {
  id: true,
  isLocked: true,
} satisfies Prisma.CommentThreadSelect;

export type ThreadState = Prisma.CommentThreadGetPayload<{
  select: typeof THREAD_SELECT;
}>;

/** Ціль коментування; `thread: null` — ще ніхто не коментував (тред створюється при першому коментарі, P4-1). */
export type CommentTargetState = { thread: ThreadState | null };

@Injectable()
export class CommentThreadRepository {
  constructor(private prisma: PrismaService) {}

  /** `null` — поста немає або він не живий (P3-1). */
  async findLivePostTarget(
    postId: string,
    now: Date,
  ): Promise<CommentTargetState | null> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...livePostWhere(now) },
      select: { commentThread: { select: THREAD_SELECT } },
    });
    return post ? { thread: post.commentThread } : null;
  }

  async findMatchTarget(matchId: string): Promise<CommentTargetState | null> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { commentThread: { select: THREAD_SELECT } },
    });
    return match ? { thread: match.commentThread } : null;
  }

  /** Upsert за унікальним `postId` / `matchId`: паралельні перші коментарі отримують один тред. */
  getOrCreateForPost(
    tx: Prisma.TransactionClient,
    postId: string,
  ): Promise<ThreadState> {
    return tx.commentThread.upsert({
      where: { postId },
      create: { postId },
      update: {},
      select: THREAD_SELECT,
    });
  }

  getOrCreateForMatch(
    tx: Prisma.TransactionClient,
    matchId: string,
  ): Promise<ThreadState> {
    return tx.commentThread.upsert({
      where: { matchId },
      create: { matchId },
      update: {},
      select: THREAD_SELECT,
    });
  }

  /** Лічильник живих коментарів (P4-4); повертає стан треду після зміни. */
  changeCommentCount(
    tx: Prisma.TransactionClient,
    threadId: string,
    delta: number,
  ): Promise<ThreadState> {
    return tx.commentThread.update({
      where: { id: threadId },
      data: { commentCount: { increment: delta } },
      select: THREAD_SELECT,
    });
  }
}
