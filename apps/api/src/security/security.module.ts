import { Module } from '@nestjs/common';
import { AuthSessionsModule } from '../auth/sessions/auth-sessions.module';
import { UsersModule } from '../users/users.module';
import { AbuseProtectionService } from './abuse-protection.service';
import { AccountModerationService } from './account-moderation.service';
import { BlockedEmailRepository } from './email-blocklist/blocked-email.repository';
import { EmailBlocklistService } from './email-blocklist/email-blocklist.service';
import { RateLimitRepository } from './rate-limit.repository';
import { SecurityCleanupCron } from './security-cleanup.cron';
import { UserSanctionRepository } from './user-sanction.repository';

/**
 * MODERATION: санкції, rate-limit, блокування акаунта, блок пошт видалених акаунтів.
 * `UsersModule` і `AuthSessionsModule` — листові (без імпортів доменних модулів), тож циклу немає.
 * `UserSanctionRepository` експортується для 2d (`UserSanction(ACCOUNT_DELETED)`).
 */
@Module({
  imports: [UsersModule, AuthSessionsModule],
  providers: [
    AbuseProtectionService,
    AccountModerationService,
    RateLimitRepository,
    UserSanctionRepository,
    BlockedEmailRepository,
    EmailBlocklistService,
    SecurityCleanupCron,
  ],
  exports: [
    AbuseProtectionService,
    AccountModerationService,
    UserSanctionRepository,
    EmailBlocklistService,
  ],
})
export class SecurityModule {}
