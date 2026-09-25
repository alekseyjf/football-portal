import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
