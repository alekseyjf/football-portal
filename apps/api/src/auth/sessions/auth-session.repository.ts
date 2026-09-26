import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Для `POST /auth/refresh`: сесія + статус і роль власника (роль — для нового access-токена). */
const SESSION_FOR_REFRESH_SELECT = {
  id: true,
  familyId: true,
  familyStartedAt: true,
  expiresAt: true,
  revokedAt: true,
  user: { select: { id: true, role: true, status: true } },
} satisfies Prisma.AuthSessionSelect;

/** Для `JwtStrategy`: власник живої сесії — статус і роль беремо з БД, не з токена. */
const SESSION_OWNER_SELECT = {
  user: { select: { id: true, role: true, status: true } },
} satisfies Prisma.AuthSessionSelect;

const CREATED_SESSION_SELECT = {
  id: true,
  expiresAt: true,
} satisfies Prisma.AuthSessionSelect;

export type SessionForRefreshRow = Prisma.AuthSessionGetPayload<{
  select: typeof SESSION_FOR_REFRESH_SELECT;
}>;
export type SessionOwnerRow = Prisma.AuthSessionGetPayload<{
  select: typeof SESSION_OWNER_SELECT;
}>['user'];
export type CreatedSessionRow = Prisma.AuthSessionGetPayload<{
  select: typeof CREATED_SESSION_SELECT;
}>;

export interface CreateSessionInput {
  userId: string;
  familyId: string;
  familyStartedAt: Date;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Лише Prisma-запити. Методи для чужих транзакцій
 * (блокування акаунта — 2c, видалення — 2d) приймають `db` (P2-8).
 */
@Injectable()
export class AuthSessionRepository {
  constructor(private prisma: PrismaService) {}

  create(
    input: CreateSessionInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<CreatedSessionRow> {
    return db.authSession.create({
      data: input,
      select: CREATED_SESSION_SELECT,
    });
  }

  findByTokenHash(tokenHash: string): Promise<SessionForRefreshRow | null> {
    return this.prisma.authSession.findUnique({
      where: { tokenHash },
      select: SESSION_FOR_REFRESH_SELECT,
    });
  }

  /**
   * Ротація (P2-4): відкликати поточну сесію лише якщо вона ще жива, і створити наступника
   * в тій самій сім'ї. Паралельний refresh тим самим токеном чекає на row lock, після commit
   * бачить `revokedAt` і отримує `null` — друга сесія не створюється.
   * Викликати лише в транзакції: відкликання й наступник мають з'явитися атомарно.
   */
  async rotate(
    tx: Prisma.TransactionClient,
    currentSessionId: string,
    successor: CreateSessionInput,
    rotatedAt: Date,
  ): Promise<CreatedSessionRow | null> {
    const revokedCurrent = await tx.authSession.updateMany({
      where: { id: currentSessionId, revokedAt: null },
      data: { revokedAt: rotatedAt, lastUsedAt: rotatedAt },
    });
    if (revokedCurrent.count !== 1) return null;

    return this.create(successor, tx);
  }

  /** Жива сесія сім'ї — ознака того, що токен уже ротувала інша вкладка (P2-5). */
  findActiveInFamily(
    familyId: string,
    now: Date,
  ): Promise<{ id: string } | null> {
    return this.prisma.authSession.findFirst({
      where: { familyId, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
  }

  /**
   * `sid` access-токена (= `familyId`): сім'я жива, поки в ній є невідкликана непрострочена сесія.
   * Logout / logout-all / reuse / блокування / видалення гасять її — і access-токен разом з нею (2f).
   * Ротація атомарна (відкликання + наступник в одній транзакції), тож між ними сім'я не «зникає».
   */
  async findLiveSessionOwner(
    familyId: string,
    userId: string,
    now: Date,
  ): Promise<SessionOwnerRow | null> {
    const liveSession = await this.prisma.authSession.findFirst({
      where: { familyId, userId, revokedAt: null, expiresAt: { gt: now } },
      select: SESSION_OWNER_SELECT,
    });
    return liveSession?.user ?? null;
  }

  /** Logout одного пристрою. Повертає кількість відкликаних (0 — вже був відкликаний). */
  async revokeByTokenHash(tokenHash: string, revokedAt: Date): Promise<number> {
    const revoked = await this.prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
    return revoked.count;
  }

  /** Reuse detection: відкликати весь ланцюжок ротацій одного логіну. */
  async revokeFamily(familyId: string, revokedAt: Date): Promise<number> {
    const revoked = await this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
    return revoked.count;
  }

  /** Logout-all; також блокування акаунта (2c) — у його транзакції. */
  async revokeAllForUser(
    userId: string,
    revokedAt: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const revoked = await db.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
    return revoked.count;
  }

  /**
   * Видалення акаунта (2d): не відкликаємо, а видаляємо — у сесіях `ipAddress`/`userAgent`
   * (персональні дані), а для DELETED-власника вони все одно дають лише 401.
   */
  async deleteAllForUser(
    userId: string,
    db: Prisma.TransactionClient,
  ): Promise<number> {
    const deleted = await db.authSession.deleteMany({ where: { userId } });
    return deleted.count;
  }

  /** Для cron (2c): прибрати сесії, прострочені раніше за `expiredBefore`. */
  async deleteExpired(expiredBefore: Date): Promise<number> {
    const deleted = await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lt: expiredBefore } },
    });
    return deleted.count;
  }
}
