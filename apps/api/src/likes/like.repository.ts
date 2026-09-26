import { Injectable } from '@nestjs/common';
import { LikeType, Prisma, ReactionTarget } from '@prisma/client';
import { visibleCommentWhere } from '../comments/comment-visibility';
import { PrismaService } from '../prisma/prisma.service';
import type { LikeTargetTypeDto } from './dto/toggle-like.dto';
import { livePostWhere } from '../posts/post-visibility';

const REACTION_TARGET_BY_TYPE: Record<LikeTargetTypeDto, ReactionTarget> = {
  post: ReactionTarget.POST,
  comment: ReactionTarget.COMMENT,
  match: ReactionTarget.MATCH,
};

/** Таблиця цілі для блокування рядка — константи, не ввід користувача. */
const LIKE_TARGET_TABLE: Record<LikeTargetTypeDto, Prisma.Sql> = {
  post: Prisma.raw('"Post"'),
  comment: Prisma.raw('"Comment"'),
  match: Prisma.raw('"Match"'),
};

export type ToggleOutcome = {
  previous: LikeType | null;
  current: LikeType | null;
};

@Injectable()
export class LikeRepository {
  constructor(private prisma: PrismaService) {}

  async getPublicLikeCount(
    targetType: LikeTargetTypeDto,
    targetId: string,
  ): Promise<number> {
    if (targetType === 'post') {
      const row = await this.prisma.post.findFirst({
        where: { id: targetId, deletedAt: null },
        select: { likeCount: true },
      });
      return row?.likeCount ?? 0;
    }
    if (targetType === 'comment') {
      const row = await this.prisma.comment.findFirst({
        where: { id: targetId, ...visibleCommentWhere(new Date()) },
        select: { likeCount: true },
      });
      return row?.likeCount ?? 0;
    }
    const row = await this.prisma.match.findFirst({
      where: { id: targetId },
      select: { likeCount: true },
    });
    return row?.likeCount ?? 0;
  }

  async findUserPostReaction(
    userId: string,
    postId: string,
  ): Promise<LikeType | null> {
    const row = await this.prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { type: true },
    });
    return row?.type ?? null;
  }

  async findUserCommentReaction(
    userId: string,
    commentId: string,
  ): Promise<LikeType | null> {
    const row = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
      select: { type: true },
    });
    return row?.type ?? null;
  }

  async findUserMatchReaction(
    userId: string,
    matchId: string,
  ): Promise<LikeType | null> {
    const row = await this.prisma.matchLike.findUnique({
      where: { userId_matchId: { userId, matchId } },
      select: { type: true },
    });
    return row?.type ?? null;
  }

  findUserReaction(
    targetType: LikeTargetTypeDto,
    userId: string,
    targetId: string,
  ): Promise<LikeType | null> {
    if (targetType === 'post') {
      return this.findUserPostReaction(userId, targetId);
    }
    if (targetType === 'comment') {
      return this.findUserCommentReaction(userId, targetId);
    }
    return this.findUserMatchReaction(userId, targetId);
  }

  /** Лише живий пост (P3-1): чернетку / запланований наперед не лайкнути за id. */
  async assertPostExists(postId: string): Promise<boolean> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...livePostWhere(new Date()) },
      select: { id: true },
    });
    return Boolean(post);
  }

  /** Коментар під чернеткою / знятим постом не лайкнути (P4-8, як P3-1 для постів). */
  async assertCommentExists(commentId: string): Promise<boolean> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, ...visibleCommentWhere(new Date()) },
      select: { id: true },
    });
    return Boolean(comment);
  }

  async assertMatchExists(matchId: string): Promise<boolean> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId },
      select: { id: true },
    });
    return Boolean(match);
  }

  /**
   * Один запис на користувача + оновлення денормалізованих лічильників на сутності.
   * `null` — цілі вже немає (напр. коментар щойно purge-нули).
   */
  async applyToggleWithCounterUpdate(
    targetType: LikeTargetTypeDto,
    userId: string,
    targetId: string,
    action: LikeType,
  ): Promise<ToggleOutcome | null> {
    return this.prisma.$transaction(async (tx) => {
      // Спершу блокуємо ціль: (1) паралельні перемикання того ж користувача читають
      // `existing` по черзі — лічильник не роз'їжджається з рядками лайків; (2) вставка лайка
      // не бере FK-блокування цілі раніше за purge — без deadlock-у й без 500 на FK
      const isTargetLocked = await this.lockTarget(tx, targetType, targetId);
      if (!isTargetLocked) return null;

      let existing: LikeType | null = null;
      if (targetType === 'post') {
        const row = await tx.postLike.findUnique({
          where: { userId_postId: { userId, postId: targetId } },
          select: { type: true },
        });
        existing = row?.type ?? null;
      } else if (targetType === 'comment') {
        const row = await tx.commentLike.findUnique({
          where: { userId_commentId: { userId, commentId: targetId } },
          select: { type: true },
        });
        existing = row?.type ?? null;
      } else {
        const row = await tx.matchLike.findUnique({
          where: { userId_matchId: { userId, matchId: targetId } },
          select: { type: true },
        });
        existing = row?.type ?? null;
      }

      const remove = existing === action;
      const next: LikeType | null = remove ? null : action;
      const delta = this.counterDelta(existing, next);

      if (targetType === 'post') {
        if (remove) {
          await tx.postLike.deleteMany({
            where: { userId, postId: targetId },
          });
        } else {
          await tx.postLike.upsert({
            where: { userId_postId: { userId, postId: targetId } },
            create: { userId, postId: targetId, type: action },
            update: { type: action },
          });
        }
        if (delta.like !== 0 || delta.dislike !== 0) {
          await tx.post.update({
            where: { id: targetId },
            data: {
              likeCount: { increment: delta.like },
              dislikeCount: { increment: delta.dislike },
            },
          });
        }
      } else if (targetType === 'comment') {
        if (remove) {
          await tx.commentLike.deleteMany({
            where: { userId, commentId: targetId },
          });
        } else {
          await tx.commentLike.upsert({
            where: { userId_commentId: { userId, commentId: targetId } },
            create: { userId, commentId: targetId, type: action },
            update: { type: action },
          });
        }
        if (delta.like !== 0 || delta.dislike !== 0) {
          await tx.comment.update({
            where: { id: targetId },
            data: {
              likeCount: { increment: delta.like },
              dislikeCount: { increment: delta.dislike },
            },
          });
        }
      } else {
        if (remove) {
          await tx.matchLike.deleteMany({
            where: { userId, matchId: targetId },
          });
        } else {
          await tx.matchLike.upsert({
            where: { userId_matchId: { userId, matchId: targetId } },
            create: { userId, matchId: targetId, type: action },
            update: { type: action },
          });
        }
        if (delta.like !== 0 || delta.dislike !== 0) {
          await tx.match.update({
            where: { id: targetId },
            data: {
              likeCount: { increment: delta.like },
              dislikeCount: { increment: delta.dislike },
            },
          });
        }
      }

      // `reaction: null` — голос знято
      await tx.userReactionActivity.create({
        data: {
          userId,
          targetType: REACTION_TARGET_BY_TYPE[targetType],
          targetId,
          reaction: next,
        },
      });

      return { previous: existing, current: next };
    });
  }

  /** `FOR NO KEY UPDATE` рядка цілі; таблиця — з фіксованого списку, не з запиту. */
  private async lockTarget(
    tx: Prisma.TransactionClient,
    targetType: LikeTargetTypeDto,
    targetId: string,
  ): Promise<boolean> {
    const lockedRows = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM ${LIKE_TARGET_TABLE[targetType]}
      WHERE "id" = ${targetId}
      FOR NO KEY UPDATE`;
    return lockedRows.length > 0;
  }

  private counterDelta(
    before: LikeType | null,
    after: LikeType | null,
  ): { like: number; dislike: number } {
    const score = (reaction: LikeType | null) =>
      reaction === LikeType.LIKE
        ? { like: 1, dislike: 0 }
        : reaction === LikeType.DISLIKE
          ? { like: 0, dislike: 1 }
          : { like: 0, dislike: 0 };
    const scoreAfter = score(after);
    const scoreBefore = score(before);
    return {
      like: scoreAfter.like - scoreBefore.like,
      dislike: scoreAfter.dislike - scoreBefore.dislike,
    };
  }
}
