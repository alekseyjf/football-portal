import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, SanctionReason, SanctionType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from '../../auth/sessions/auth-session.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailBlocklistService } from '../../security/email-blocklist/email-blocklist.service';
import { UserSanctionRepository } from '../../security/user-sanction.repository';
import { UserRepository } from '../user.repository';

const USER_NOT_FOUND = 'USER_NOT_FOUND';
const ADMIN_ACCOUNT_NOT_DELETABLE = 'ADMIN_ACCOUNT_NOT_DELETABLE';
const ACCOUNT_ALREADY_DELETED = 'ACCOUNT_ALREADY_DELETED';
/**
 * 403, а не 401: 401 фронт сприймає як прострочений access-токен
 * і робить refresh + повтор (2e), хоча сесія жива — неправильний лише пароль.
 */
const INVALID_PASSWORD = 'INVALID_PASSWORD';

/** Хто і чому видалив чужий акаунт — пишеться як `UserSanction(ACCOUNT_DELETED)`. */
interface AdminDeletionAudit {
  adminId: string;
  note: string | null;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private sessionRepository: AuthSessionRepository,
    private sanctionRepository: UserSanctionRepository,
    private emailBlocklist: EmailBlocklistService,
  ) {}

  /** `DELETE /users/me`. Статус ACTIVE щойно перевірив `JwtStrategy`. */
  async deleteOwnAccount(userId: string, password: string): Promise<void> {
    const credentials = await this.userRepository.findCredentialsById(userId);
    if (!credentials) throw new UnauthorizedException();
    assertAccountDeletable(credentials);

    const passwordMatches = await bcrypt.compare(
      password,
      credentials.passwordHash,
    );
    if (!passwordMatches) throw new ForbiddenException(INVALID_PASSWORD);

    // Self-delete у UserSanction не логуємо — `deletedAt` і є аудит власної дії (7.5.1)
    await this.deleteAccount(userId, null);
    this.logger.log(`Account ${userId} deleted by its owner`);
  }

  /** `DELETE /users/:id` (ADMIN). LOCKED-акаунт теж можна видалити. */
  async deleteUserAsAdmin(
    targetUserId: string,
    adminId: string,
    note: string | undefined,
  ): Promise<void> {
    const target = await this.userRepository.findAccessById(targetUserId);
    if (!target) throw new NotFoundException(USER_NOT_FOUND);
    assertAccountDeletable(target);

    await this.deleteAccount(targetUserId, { adminId, note: note || null });
    this.logger.log(`Account ${targetUserId} deleted by admin ${adminId}`);
  }

  /**
   * D19 / 7.5.1 — одна транзакція: анонімізація + `status = DELETED` + `deletedAt`,
   * блок пошти (admin — назавжди, self — 30 днів), аудит (лише admin) і видалення всіх сесій.
   * Пости й коментарі лишаються.
   * Уже видані access-токени перестають діяти одразу: `JwtStrategy` читає статус з БД.
   */
  private async deleteAccount(
    userId: string,
    adminAudit: AdminDeletionAudit | null,
  ): Promise<void> {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      // До анонімізації: після неї справжньої адреси вже ніде немає
      const originalEmail = await this.userRepository.findEmailById(userId, tx);
      if (!originalEmail) return false;

      const anonymized = await this.userRepository.markDeleted(
        userId,
        deletedAt,
        tx,
      );
      if (!anonymized) return false;

      await this.emailBlocklist.blockDeletedAccountEmail(
        originalEmail,
        adminAudit ? 'ADMIN' : 'OWNER',
        deletedAt,
        tx,
      );

      if (adminAudit) {
        await this.sanctionRepository.create(
          {
            userId,
            type: SanctionType.ACCOUNT_DELETED,
            reason: SanctionReason.MANUAL,
            startsAt: deletedAt,
            endsAt: null,
            issuedById: adminAudit.adminId,
            note: adminAudit.note,
          },
          tx,
        );
      }
      await this.sessionRepository.deleteAllForUser(userId, tx);
      return true;
    });

    // Між перевіркою і записом стан змінився: паралельне видалення встигло першим.
    if (!deleted) throw new ConflictException(ACCOUNT_ALREADY_DELETED);
  }
}

/** Перевірка заради коду помилки; атомарно те саме гарантує `markDeleted`. */
function assertAccountDeletable(account: {
  role: Role;
  status: UserStatus;
}): void {
  if (account.status === UserStatus.DELETED) {
    throw new ConflictException(ACCOUNT_ALREADY_DELETED);
  }
  // P2-14: інакше можна лишитися без жодного адміна
  if (account.role === Role.ADMIN) {
    throw new ForbiddenException(ADMIN_ACCOUNT_NOT_DELETABLE);
  }
}
