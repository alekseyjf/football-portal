import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  RateLimitAction,
  SanctionReason,
  SanctionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSanctionInput {
  userId: string;
  type: SanctionType;
  reason: SanctionReason;
  startsAt: Date;
  /** null = безстроково */
  endsAt: Date | null;
  /** null = автоматично (анти-абуз) */
  issuedById: string | null;
  note: string | null;
}

/** Активна = не відкликана, вже почалась і ще не закінчилась. */
function activeSanctionWhere(
  userId: string,
  type: SanctionType,
  now: Date,
): Prisma.UserSanctionWhereInput {
  return {
    userId,
    type,
    revokedAt: null,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/** Лише Prisma-запити; методи для транзакцій сервісу приймають `db` (P2-8). */
@Injectable()
export class UserSanctionRepository {
  constructor(private prisma: PrismaService) {}

  async hasActive(
    userId: string,
    type: SanctionType,
    now: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const activeSanction = await db.userSanction.findFirst({
      where: activeSanctionWhere(userId, type, now),
      select: { id: true },
    });
    return activeSanction !== null;
  }

  /** Strikes = невідкликані санкції типу за весь час, у т.ч. прострочені (P2-11). */
  countStrikes(
    userId: string,
    type: SanctionType,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return db.userSanction.count({
      where: { userId, type, revokedAt: null },
    });
  }

  async create(
    input: CreateSanctionInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await db.userSanction.create({ data: input, select: { id: true } });
  }

  /**
   * P2-10: серіалізує видачу санкцій одному користувачу за однією дією до кінця транзакції.
   * Саме `xact`-лок: сесійний не пережив би transaction pooling Supabase.
   */
  async lockSanctionIssuing(
    tx: Prisma.TransactionClient,
    userId: string,
    action: RateLimitAction,
  ): Promise<void> {
    const lockKey = `${userId}:${action}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
}
