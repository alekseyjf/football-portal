import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma, RateLimitAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ABUSE_STRIKES_LOCK_ACCOUNT,
  ACCOUNT_LOCKED_CODE,
  getRateLimitPolicy,
  type RateLimitPolicy,
} from './abuse.constants';
import { AccountModerationService } from './account-moderation.service';
import { RateLimitRepository } from './rate-limit.repository';
import { UserSanctionRepository } from './user-sanction.repository';

type BurstOutcome = 'SUSPENDED' | 'LOCKED';

/**
 * Спільний анти-абуз для всіх дій (P2-9); політика — `getRateLimitPolicy(action)`.
 * Адмінів пропускають обгортки (`LikeAntiAbuseService`, `CommentAntiAbuseService`).
 * Блок акаунта тут не перевіряємо — це робить `JwtStrategy` (P2-12).
 */
@Injectable()
export class AbuseProtectionService {
  private readonly log = new Logger(AbuseProtectionService.name);

  constructor(
    private prisma: PrismaService,
    private rateLimitRepository: RateLimitRepository,
    private sanctionRepository: UserSanctionRepository,
    private accountModeration: AccountModerationService,
  ) {}

  /** До дії: активна санкція → 403, не минув cooldown → 429. */
  async assertActionAllowed(
    userId: string,
    action: RateLimitAction,
  ): Promise<void> {
    const policy = getRateLimitPolicy(action);
    const now = new Date();

    const isSuspended = await this.sanctionRepository.hasActive(
      userId,
      policy.sanctionType,
      now,
    );
    if (isSuspended) {
      throw new HttpException(policy.suspendedCode, HttpStatus.FORBIDDEN);
    }

    if (policy.cooldown && policy.cooldown.ms > 0) {
      const lastEventAt = await this.rateLimitRepository.findLastEventAt(
        userId,
        action,
      );
      if (
        lastEventAt &&
        now.getTime() - lastEventAt.getTime() < policy.cooldown.ms
      ) {
        throw new HttpException(
          policy.cooldown.code,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  /**
   * Записати спробу; `burstThreshold` подій у вікні → санкція (403).
   * Друга невідкликана санкція типу → блок акаунта (403 `ACCOUNT_LOCKED`).
   * Події після санкції не видаляємо — з них рахується cooldown (P2-11).
   */
  async recordActionAndEnforceBurst(
    userId: string,
    action: RateLimitAction,
  ): Promise<void> {
    const policy = getRateLimitPolicy(action);
    const occurredAt = new Date();

    await this.rateLimitRepository.recordEvent(userId, action, occurredAt);
    const recentEvents = await this.rateLimitRepository.countSince(
      userId,
      action,
      new Date(occurredAt.getTime() - policy.burstWindowMs),
    );
    if (recentEvents < policy.burstThreshold) return;

    // Кидаємо після commit: exception усередині `$transaction` відкотив би санкцію
    const outcome = await this.prisma.$transaction((tx) =>
      this.issueBurstSanction(tx, userId, action, policy),
    );

    if (outcome === 'LOCKED') {
      this.log.warn(
        `Акаунт ${userId} заблоковано: повторний ${policy.sanctionReason}`,
      );
      throw new HttpException(ACCOUNT_LOCKED_CODE, HttpStatus.FORBIDDEN);
    }
    throw new HttpException(policy.suspendedCode, HttpStatus.FORBIDDEN);
  }

  /** P2-10: під advisory lock, щоб паралельні запити одного burst-у дали одну санкцію. */
  private async issueBurstSanction(
    tx: Prisma.TransactionClient,
    userId: string,
    action: RateLimitAction,
    policy: RateLimitPolicy,
  ): Promise<BurstOutcome> {
    await this.sanctionRepository.lockSanctionIssuing(tx, userId, action);

    // Час — після локу: санкція паралельного запиту має startsAt пізніше за момент нашої спроби
    const issuedAt = new Date();
    const alreadySuspended = await this.sanctionRepository.hasActive(
      userId,
      policy.sanctionType,
      issuedAt,
      tx,
    );
    if (alreadySuspended) return 'SUSPENDED';

    const previousStrikes = await this.sanctionRepository.countStrikes(
      userId,
      policy.sanctionType,
      tx,
    );
    await this.sanctionRepository.create(
      {
        userId,
        type: policy.sanctionType,
        reason: policy.sanctionReason,
        startsAt: issuedAt,
        endsAt: new Date(issuedAt.getTime() + policy.suspensionMs),
        issuedById: null,
        note: null,
      },
      tx,
    );

    const strikes = previousStrikes + 1;
    if (strikes < ABUSE_STRIKES_LOCK_ACCOUNT) return 'SUSPENDED';

    const locked = await this.accountModeration.lockAccount(
      {
        userId,
        reason: policy.sanctionReason,
        issuedById: null,
        note: `${strikes} × ${policy.sanctionType}`,
      },
      tx,
    );
    return locked ? 'LOCKED' : 'SUSPENDED';
  }
}
