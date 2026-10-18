import { Inject, Injectable } from '@nestjs/common';
import { EmailBlockReason, type Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { envConfig } from '../../config/env.config';
import type { AppEnv } from '../../config/env.schema';
import {
  BlockedEmailRepository,
  type BlockedEmailRow,
} from './blocked-email.repository';
import { canonicalizeEmail } from './canonical-email';

/** Скільки пошта того, хто видалив акаунт сам, недоступна для нової реєстрації. */
export const SELF_DELETED_EMAIL_BLOCK_MS = 30 * 24 * 60 * 60 * 1000;

export type AccountDeletedBy = 'ADMIN' | 'OWNER';

/**
 * Блок пошт видалених акаунтів (2d): admin — безстроково, self — на 30 днів.
 * У БД лише HMAC канонічної адреси: без `EMAIL_HASH_SECRET` витік таблиці
 * не дозволяє перевірити «чи була заблокована x@y» перебором.
 */
@Injectable()
export class EmailBlocklistService {
  private readonly hashSecret: string;

  constructor(
    private blockedEmailRepository: BlockedEmailRepository,
    @Inject(envConfig.KEY) env: AppEnv,
  ) {
    this.hashSecret = env.EMAIL_HASH_SECRET;
  }

  /** `normalizedEmail` — уже `toLowerCase().trim()`. */
  async isBlocked(normalizedEmail: string, now: Date): Promise<boolean> {
    const activeBlock = await this.blockedEmailRepository.findActive(
      this.hashEmail(normalizedEmail),
      now,
    );
    return activeBlock !== null;
  }

  /**
   * У транзакції видалення акаунта, до анонімізації email.
   * Слабший блок не перезаписує сильніший (безстроковий > довший > коротший).
   */
  async blockDeletedAccountEmail(
    normalizedEmail: string,
    deletedBy: AccountDeletedBy,
    deletedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const emailHash = this.hashEmail(normalizedEmail);
    const requestedBlock: BlockedEmailRow =
      deletedBy === 'ADMIN'
        ? {
            reason: EmailBlockReason.ACCOUNT_DELETED_BY_ADMIN,
            blockedUntil: null,
          }
        : {
            reason: EmailBlockReason.ACCOUNT_SELF_DELETED,
            blockedUntil: new Date(
              deletedAt.getTime() + SELF_DELETED_EMAIL_BLOCK_MS,
            ),
          };

    await this.blockedEmailRepository.lockEmailHash(emailHash, tx);
    const existingBlock = await this.blockedEmailRepository.findByHash(
      emailHash,
      tx,
    );
    if (existingBlock && !isStrongerBlock(requestedBlock, existingBlock)) {
      return;
    }
    await this.blockedEmailRepository.save(
      { emailHash, ...requestedBlock },
      tx,
    );
  }

  private hashEmail(normalizedEmail: string): string {
    return createHmac('sha256', this.hashSecret)
      .update(canonicalizeEmail(normalizedEmail))
      .digest('hex');
  }
}

function isStrongerBlock(
  candidate: BlockedEmailRow,
  current: BlockedEmailRow,
): boolean {
  if (current.blockedUntil === null) return false;
  if (candidate.blockedUntil === null) return true;
  return candidate.blockedUntil > current.blockedUntil;
}
