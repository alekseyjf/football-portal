import { Injectable } from '@nestjs/common';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DELETED_ACCOUNT_PASSWORD_HASH,
  DELETED_USER_DISPLAY_NAME,
  deletedAccountEmail,
} from './deleted-account';

/**
 * Без `profile`: relation — окремий запит до БД, і лише коли email знайдено.
 * Це давало помітну різницю часу «email є / нема» (P2-2); профіль вантажимо після пароля.
 */
const USER_CREDENTIALS_SELECT = {
  id: true,
  role: true,
  status: true,
  passwordHash: true,
} satisfies Prisma.UserSelect;

/** Для JwtStrategy: мінімум на кожен захищений запит (P2-1). */
const USER_ACCESS_SELECT = {
  id: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect;

/** Користувач для відповідей auth (`login`, `register`, згодом `me`). */
const USER_ACCOUNT_SELECT = {
  id: true,
  email: true,
  role: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

export type UserCredentialsRow = Prisma.UserGetPayload<{
  select: typeof USER_CREDENTIALS_SELECT;
}>;
export type UserAccessRow = Prisma.UserGetPayload<{
  select: typeof USER_ACCESS_SELECT;
}>;
export type UserAccountRow = Prisma.UserGetPayload<{
  select: typeof USER_ACCOUNT_SELECT;
}>;

export interface CreateUserWithProfileInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  findCredentialsByEmail(email: string): Promise<UserCredentialsRow | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_CREDENTIALS_SELECT,
    });
  }

  /** `DELETE /users/me`: підтвердження паролем. */
  findCredentialsById(userId: string): Promise<UserCredentialsRow | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_CREDENTIALS_SELECT,
    });
  }

  /** Видалення акаунта: справжня адреса для блоклиста — читаємо в тій самій транзакції, до анонімізації. */
  async findEmailById(
    userId: string,
    db: Prisma.TransactionClient,
  ): Promise<string | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  findAccountById(userId: string): Promise<UserAccountRow | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_ACCOUNT_SELECT,
    });
  }

  findAccessById(userId: string): Promise<UserAccessRow | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_ACCESS_SELECT,
    });
  }

  /**
   * ACTIVE → LOCKED. `false` — користувач уже LOCKED/DELETED або не існує.
   * Умова в `where` + row lock: з двох паралельних блокувань спрацює лише одне.
   */
  async markLocked(
    userId: string,
    lockedAt: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const locked = await db.user.updateMany({
      where: { id: userId, status: UserStatus.ACTIVE },
      data: { status: UserStatus.LOCKED, lockedAt },
    });
    return locked.count === 1;
  }

  /**
   * Анонімізація (D19): email, пароль і профіль → заглушки, `status = DELETED`, `deletedAt`.
   * Умова в `where` — атомарний запобіжник (сервіс перевіряє те саме заздалегідь заради
   * кодів помилок): ADMIN не видаляється (P2-14), повторне видалення не спрацює.
   * `false` — умова не виконалась; профіль тоді не чіпаємо. Лише в транзакції викликача.
   */
  async markDeleted(
    userId: string,
    deletedAt: Date,
    db: Prisma.TransactionClient,
  ): Promise<boolean> {
    const deleted = await db.user.updateMany({
      where: {
        id: userId,
        role: Role.USER,
        status: { not: UserStatus.DELETED },
      },
      data: {
        email: deletedAccountEmail(userId),
        passwordHash: DELETED_ACCOUNT_PASSWORD_HASH,
        status: UserStatus.DELETED,
        deletedAt,
      },
    });
    if (deleted.count !== 1) return false;

    await db.userProfile.updateMany({
      where: { userId },
      data: {
        displayName: DELETED_USER_DISPLAY_NAME,
        avatarUrl: null,
        bio: null,
      },
    });
    return true;
  }

  /** User + UserProfile одним nested create — Prisma виконує його атомарно. */
  createWithProfile(
    input: CreateUserWithProfileInput,
  ): Promise<UserAccountRow> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        profile: { create: { displayName: input.displayName } },
      },
      select: USER_ACCOUNT_SELECT,
    });
  }
}
