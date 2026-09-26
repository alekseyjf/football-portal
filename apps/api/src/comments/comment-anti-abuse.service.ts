import { Injectable } from '@nestjs/common';
import { RateLimitAction } from '@prisma/client';
import { AbuseProtectionService } from '../security/abuse-protection.service';

/** Тонка обгортка над спільним анти-абузом (P2-9); адміни не обмежуються. */
@Injectable()
export class CommentAntiAbuseService {
  constructor(private abuseProtection: AbuseProtectionService) {}

  /** Бан на коментарі → 403, cooldown між коментарями → 429. */
  async assertCanCommentOrThrow(userId: string, isAdmin: boolean) {
    if (isAdmin) return;
    await this.abuseProtection.assertActionAllowed(
      userId,
      RateLimitAction.COMMENT,
    );
  }

  /**
   * Реєструє спробу коментаря (з неї ж рахується cooldown); burst → 24h бан, повторний strike → блок акаунта.
   */
  async recordCommentAttemptAndEnforceBurstOrThrow(
    userId: string,
    isAdmin: boolean,
  ) {
    if (isAdmin) return;
    await this.abuseProtection.recordActionAndEnforceBurst(
      userId,
      RateLimitAction.COMMENT,
    );
  }
}
