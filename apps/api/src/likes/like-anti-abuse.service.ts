import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ABUSE_STRIKES_LOCK_ACCOUNT,
  LIKE_BURST_THRESHOLD,
  LIKE_BURST_WINDOW_MS,
  LIKE_SUSPENSION_MS,
} from '../security/abuse.constants';

@Injectable()
export class LikeAntiAbuseService {
  constructor(private prisma: PrismaService) {}

  async assertCanLikeOrThrow(userId: string, isAdmin: boolean) {
    if (isAdmin) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { likesSuspendedUntil: true, accountLockedAt: true },
    });
    if (!user) return;
    if (user.accountLockedAt && user.accountLockedAt.getTime() > 0) {
      throw new HttpException('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
    }
    const now = new Date();
    if (user.likesSuspendedUntil && user.likesSuspendedUntil > now) {
      throw new HttpException('LIKES_SUSPENDED', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Реєструє спробу лайку; burst у вікні → 24h бан на лайки, повторний strike → блок акаунта.
   */
  async recordLikeAttemptAndEnforceBurstOrThrow(
    userId: string,
    isAdmin: boolean,
  ) {
    if (isAdmin) return;
    await this.prisma.likeBurstLog.create({ data: { userId } });
    const windowStart = new Date(Date.now() - LIKE_BURST_WINDOW_MS);
    const recent = await this.prisma.likeBurstLog.count({
      where: { userId, createdAt: { gte: windowStart } },
    });
    if (recent >= LIKE_BURST_THRESHOLD) {
      await this.applyLikeSuspension(userId);
    }
  }

  private async applyLikeSuspension(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { likeAbuseStrikes: true },
    });
    const nextStrike = (user?.likeAbuseStrikes ?? 0) + 1;
    const until = new Date(Date.now() + LIKE_SUSPENSION_MS);
    const lockAccount = nextStrike >= ABUSE_STRIKES_LOCK_ACCOUNT;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        likesSuspendedUntil: until,
        likeAbuseStrikes: nextStrike,
        ...(lockAccount ? { accountLockedAt: new Date() } : {}),
      },
    });
    await this.prisma.likeBurstLog.deleteMany({ where: { userId } });
    throw new HttpException(
      lockAccount ? 'ACCOUNT_LOCKED' : 'LIKES_SUSPENDED',
      HttpStatus.FORBIDDEN,
    );
  }
}
