import { Injectable } from '@nestjs/common';
import { SanctionType, type Prisma, type SanctionReason } from '@prisma/client';
import { AuthSessionRepository } from '../auth/sessions/auth-session.repository';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../users/user.repository';
import { UserSanctionRepository } from './user-sanction.repository';

export interface LockAccountInput {
  userId: string;
  reason: SanctionReason;
  /** null = автоматично (анти-абуз) */
  issuedById: string | null;
  note: string | null;
}

@Injectable()
export class AccountModerationService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private sanctionRepository: UserSanctionRepository,
    private sessionRepository: AuthSessionRepository,
  ) {}

  /**
   * `status = LOCKED` + `lockedAt` + `UserSanction(ACCOUNT_LOCKED)` + відкликати всі сесії — атомарно.
   * `db` — транзакція викликача (анти-абуз блокує в тій самій транзакції, що й видає strike).
   * Повертає `false`, якщо акаунт уже не ACTIVE: нічого не змінюємо, дубль санкції не пишемо.
   * Логує викликач — після commit, щоб лог не збрехав при rollback.
   */
  async lockAccount(
    input: LockAccountInput,
    db?: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (!db) {
      return this.prisma.$transaction((tx) => this.lockAccount(input, tx));
    }

    const lockedAt = new Date();
    const wasActive = await this.userRepository.markLocked(
      input.userId,
      lockedAt,
      db,
    );
    if (!wasActive) return false;

    await this.sanctionRepository.create(
      {
        userId: input.userId,
        type: SanctionType.ACCOUNT_LOCKED,
        reason: input.reason,
        startsAt: lockedAt,
        endsAt: null,
        issuedById: input.issuedById,
        note: input.note,
      },
      db,
    );
    await this.sessionRepository.revokeAllForUser(input.userId, lockedAt, db);
    return true;
  }
}
