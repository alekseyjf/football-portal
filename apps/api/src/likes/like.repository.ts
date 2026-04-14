import { Injectable } from '@nestjs/common';
import { LikeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { LikeTargetTypeDto } from './dto/toggle-like.dto';

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
        where: { id: targetId, deletedAt: null },
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

  async assertPostExists(postId: string): Promise<boolean> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });
    return Boolean(post);
  }

  async assertCommentExists(commentId: string): Promise<boolean> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
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
   */
  async applyToggleWithCounterUpdate(
    targetType: LikeTargetTypeDto,
    userId: string,
    targetId: string,
    action: LikeType,
  ): Promise<ToggleOutcome> {
    return this.prisma.$transaction(async (tx) => {
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

      const stateLabel =
        next === null ? 'NONE' : next === LikeType.LIKE ? 'LIKE' : 'DISLIKE';
      await tx.userReactionActivity.create({
        data: {
          userId,
          targetType,
          targetId,
          state: stateLabel,
        },
      });

      return { previous: existing, current: next };
    });
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
    const a = score(after);
    const b = score(before);
    return { like: a.like - b.like, dislike: a.dislike - b.dislike };
  }
}
