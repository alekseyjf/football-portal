import { Injectable } from '@nestjs/common';
import type { EmailBlockReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const BLOCKED_EMAIL_SELECT = {
  reason: true,
  blockedUntil: true,
} satisfies Prisma.BlockedEmailSelect;

export type BlockedEmailRow = Prisma.BlockedEmailGetPayload<{
  select: typeof BLOCKED_EMAIL_SELECT;
}>;

export interface SaveEmailBlockInput {
  emailHash: string;
  reason: EmailBlockReason;
  /** null = безстроково */
  blockedUntil: Date | null;
}

/** Лише Prisma-запити; рішення «який блок сильніший» — у `EmailBlocklistService`. */
@Injectable()
export class BlockedEmailRepository {
  constructor(private prisma: PrismaService) {}

  /** Активний = безстроковий або ще не закінчився. */
  findActive(emailHash: string, now: Date): Promise<BlockedEmailRow | null> {
    return this.prisma.blockedEmail.findFirst({
      where: {
        emailHash,
        OR: [{ blockedUntil: null }, { blockedUntil: { gt: now } }],
      },
      select: BLOCKED_EMAIL_SELECT,
    });
  }

  /**
   * Серіалізує зміну блоку однієї адреси до кінця транзакції: інакше два паралельні
   * видалення (admin + self) прочитають «блоку немає», і 30-денний перезапише безстроковий.
   * Саме `xact` — сесійний лок не переживає transaction pooling Supabase (як P2-10).
   */
  async lockEmailHash(
    emailHash: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${emailHash}))`;
  }

  findByHash(
    emailHash: string,
    db: Prisma.TransactionClient,
  ): Promise<BlockedEmailRow | null> {
    return db.blockedEmail.findUnique({
      where: { emailHash },
      select: BLOCKED_EMAIL_SELECT,
    });
  }

  /** Native upsert (`ON CONFLICT`): паралельні видалення з тією самою адресою не падають на `@unique`. */
  async save(
    input: SaveEmailBlockInput,
    db: Prisma.TransactionClient,
  ): Promise<void> {
    await db.blockedEmail.upsert({
      where: { emailHash: input.emailHash },
      create: input,
      update: { reason: input.reason, blockedUntil: input.blockedUntil },
      select: { id: true },
    });
  }

  /** Для cron: прострочені тимчасові блоки більше нічого не блокують. */
  async deleteExpired(now: Date): Promise<number> {
    const deleted = await this.prisma.blockedEmail.deleteMany({
      where: { blockedUntil: { lt: now } },
    });
    return deleted.count;
  }
}
