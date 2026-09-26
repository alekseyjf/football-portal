import { Injectable } from '@nestjs/common';
import { RateLimitAction } from '@prisma/client';
import { AbuseProtectionService } from '../security/abuse-protection.service';

/** Тонка обгортка над спільним анти-абузом (P2-9); адміни не обмежуються. */
@Injectable()
export class LikeAntiAbuseService {
  constructor(private abuseProtection: AbuseProtectionService) {}

  async assertCanLikeOrThrow(userId: string, isAdmin: boolean) {
    if (isAdmin) return;
    await this.abuseProtection.assertActionAllowed(
      userId,
      RateLimitAction.LIKE,
    );
  }

  /**
   * Реєструє спробу лайку; burst у вікні → 24h бан на лайки, повторний strike → блок акаунта.
   */
  async recordLikeAttemptAndEnforceBurstOrThrow(
    userId: string,
    isAdmin: boolean,
  ) {
    if (isAdmin) return;
    await this.abuseProtection.recordActionAndEnforceBurst(
      userId,
      RateLimitAction.LIKE,
    );
  }
}
