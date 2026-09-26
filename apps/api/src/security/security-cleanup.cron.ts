import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthSessionRepository } from '../auth/sessions/auth-session.repository';
import {
  EXPIRED_SESSION_RETENTION_MS,
  RATE_LIMIT_EVENT_RETENTION_MS,
} from './abuse.constants';
import { BlockedEmailRepository } from './email-blocklist/blocked-email.repository';
import { RateLimitRepository } from './rate-limit.repository';

/** Розділ 7: прострочені `AuthSession` (> 7 д), `RateLimitEvent` (> 24 год); 2d: прострочені `BlockedEmail`. */
@Injectable()
export class SecurityCleanupCron {
  private readonly log = new Logger(SecurityCleanupCron.name);

  constructor(
    private sessionRepository: AuthSessionRepository,
    private rateLimitRepository: RateLimitRepository,
    private blockedEmailRepository: BlockedEmailRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeStaleSecurityRecords(): Promise<void> {
    const now = Date.now();
    // Кроки незалежні: збій одного не має блокувати інший
    try {
      const deletedSessions = await this.sessionRepository.deleteExpired(
        new Date(now - EXPIRED_SESSION_RETENTION_MS),
      );
      if (deletedSessions > 0) {
        this.log.log(`Видалено прострочених сесій: ${deletedSessions}`);
      }
    } catch (err) {
      this.log.warn(`Очищення AuthSession: ${err}`);
    }

    try {
      const deletedEvents = await this.rateLimitRepository.deleteOlderThan(
        new Date(now - RATE_LIMIT_EVENT_RETENTION_MS),
      );
      if (deletedEvents > 0) {
        this.log.log(`Видалено RateLimitEvent: ${deletedEvents}`);
      }
    } catch (err) {
      this.log.warn(`Очищення RateLimitEvent: ${err}`);
    }

    try {
      const deletedBlocks = await this.blockedEmailRepository.deleteExpired(
        new Date(now),
      );
      if (deletedBlocks > 0) {
        this.log.log(`Видалено прострочених BlockedEmail: ${deletedBlocks}`);
      }
    } catch (err) {
      this.log.warn(`Очищення BlockedEmail: ${err}`);
    }
  }
}
