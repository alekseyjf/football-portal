import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ABUSE_STRIKES_LOCK_ACCOUNT,
  COMMENT_BURST_THRESHOLD,
  COMMENT_BURST_WINDOW_MS,
  COMMENT_SUSPENSION_MS,
  getCommentCooldownMs,
} from '../security/abuse.constants';

@Injectable()
export class CommentAntiAbuseService {
  constructor(private prisma: PrismaService) {}

  async assertCanCommentOrThrow(userId: string, isAdmin: boolean) {
    if (isAdmin) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        commentsSuspendedUntil: true,
        lastCommentAt: true,
        accountLockedAt: true,
      },
    });
    if (!user) return;
    if (user.accountLockedAt && user.accountLockedAt.getTime() > 0) {
      throw new HttpException('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
    }
    const now = new Date();
    if (user.commentsSuspendedUntil && user.commentsSuspendedUntil > now) {
      throw new HttpException('COMMENTS_SUSPENDED', HttpStatus.FORBIDDEN);
    }
    const cooldownMs = getCommentCooldownMs();
    if (user.lastCommentAt && cooldownMs > 0) {
      const elapsed = now.getTime() - user.lastCommentAt.getTime();
      if (elapsed < cooldownMs) {
        throw new HttpException('COMMENT_COOLDOWN', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  async recordCommentAttemptAndEnforceBurstOrThrow(
    userId: string,
    isAdmin: boolean,
  ) {
    if (isAdmin) return;
    await this.prisma.commentBurstLog.create({ data: { userId } });
    const windowStart = new Date(Date.now() - COMMENT_BURST_WINDOW_MS);
    const recent = await this.prisma.commentBurstLog.count({
      where: { userId, createdAt: { gte: windowStart } },
    });
    if (recent >= COMMENT_BURST_THRESHOLD) {
      await this.applyCommentSuspension(userId);
    }
  }

  private async applyCommentSuspension(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { commentAbuseStrikes: true },
    });
    const nextStrike = (user?.commentAbuseStrikes ?? 0) + 1;
    const until = new Date(Date.now() + COMMENT_SUSPENSION_MS);
    const lockAccount = nextStrike >= ABUSE_STRIKES_LOCK_ACCOUNT;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        commentsSuspendedUntil: until,
        commentAbuseStrikes: nextStrike,
        ...(lockAccount ? { accountLockedAt: new Date() } : {}),
      },
    });
    await this.prisma.commentBurstLog.deleteMany({ where: { userId } });
    throw new HttpException(
      lockAccount ? 'ACCOUNT_LOCKED' : 'COMMENTS_SUSPENDED',
      HttpStatus.FORBIDDEN,
    );
  }
}
