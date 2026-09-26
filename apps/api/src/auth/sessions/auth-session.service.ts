import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_SESSION_TTL_MS,
  REFRESH_SUPERSEDED_GRACE_MS,
  readJwtSecret,
} from '../auth.constants';
import type { AccessTokenPayload } from '../auth.service';
import type { SessionClientContext } from '../session-client-context';
import {
  AuthSessionRepository,
  type SessionForRefreshRow,
} from './auth-session.repository';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';

/** Те, що контролер кладе в cookies. `refreshToken` — сирий, у БД лише його хеш. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Один код на всі «невалідні» випадки — клієнту не кажемо, чи спрацювала reuse detection. */
const INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN';
const REFRESH_SUPERSEDED = 'REFRESH_SUPERSEDED';
const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);
  private readonly jwtSecret = readJwtSecret();

  constructor(
    private prisma: PrismaService,
    private sessionRepository: AuthSessionRepository,
    private jwt: JwtService,
  ) {}

  /** Логін: нова сім'я сесій. */
  async startSession(
    user: { id: string; role: AccessTokenPayload['role'] },
    client: SessionClientContext,
  ): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    const session = await this.sessionRepository.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryFrom(new Date()),
      ...client,
    });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  /**
   * `POST /auth/refresh` (розділ 7, P2-3…P2-6). Порядок перевірок важливий:
   * нема/прострочена → статус власника → відкликана → ротація.
   */
  async rotateSession(
    rawRefreshToken: string | undefined,
    client: SessionClientContext,
  ): Promise<AuthTokens> {
    if (!rawRefreshToken)
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);
    const now = new Date();
    if (!session || session.expiresAt <= now) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    // До перевірки revokedAt: блокування відкликає всі сесії, і без цього
    // заблокований користувач виглядав би як «reuse detected» (P2-3).
    assertSessionOwnerActive(session.user.status);

    if (session.revokedAt) {
      return this.rejectRevokedToken(session.familyId, session.revokedAt, now);
    }

    const successorToken = generateRefreshToken();
    const successor = await this.prisma.$transaction((tx) =>
      this.sessionRepository.rotate(
        tx,
        session.id,
        {
          userId: session.user.id,
          familyId: session.familyId,
          tokenHash: hashRefreshToken(successorToken),
          expiresAt: refreshExpiryFrom(now),
          ...client,
        },
        now,
      ),
    );

    // Паралельний запит з тим самим токеном ротував його першим (P2-4).
    if (!successor) {
      const supersededSession =
        await this.sessionRepository.findByTokenHash(tokenHash);
      return this.rejectRevokedToken(
        session.familyId,
        supersededSession?.revokedAt ?? now,
        now,
      );
    }

    return {
      accessToken: await this.signAccessToken(session.user),
      refreshToken: successorToken,
      refreshExpiresAt: successor.expiresAt,
    };
  }

  /** Logout одного пристрою. Ідемпотентний: без cookie або з уже відкликаним токеном — no-op. */
  async endSession(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.sessionRepository.revokeByTokenHash(
      hashRefreshToken(rawRefreshToken),
      new Date(),
    );
  }

  endAllSessions(userId: string): Promise<number> {
    return this.sessionRepository.revokeAllForUser(userId, new Date());
  }

  /**
   * Відкликаний токен прийшов повторно.
   * - Щойно ротований і в сім'ї є живий наступник → гонка вкладок, 409 без наслідків (P2-5).
   * - Інакше → reuse: відкликаємо всю сім'ю, 401.
   */
  private async rejectRevokedToken(
    familyId: string,
    revokedAt: Date,
    now: Date,
  ): Promise<never> {
    const revokedRecently =
      now.getTime() - revokedAt.getTime() < REFRESH_SUPERSEDED_GRACE_MS;
    if (
      revokedRecently &&
      (await this.sessionRepository.findActiveInFamily(familyId, now))
    ) {
      throw new ConflictException(REFRESH_SUPERSEDED);
    }

    const revokedCount = await this.sessionRepository.revokeFamily(
      familyId,
      now,
    );
    // 0 — сім'я вже неактивна (logout, logout-all, повторна спроба): не тривога.
    if (revokedCount > 0) {
      this.logger.warn(
        `Refresh token reuse detected: family ${familyId} revoked (${revokedCount} active session(s))`,
      );
    }
    throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
  }

  private signAccessToken(user: {
    id: string;
    role: AccessTokenPayload['role'];
  }): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload, {
      secret: this.jwtSecret,
      algorithm: ACCESS_TOKEN_ALGORITHM,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }
}

function refreshExpiryFrom(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + REFRESH_SESSION_TTL_MS);
}

/** LOCKED → 403 (власник має знати, чому його не пускає); DELETED → 401, як «сесії немає». */
function assertSessionOwnerActive(
  ownerStatus: SessionForRefreshRow['user']['status'],
): void {
  if (ownerStatus === UserStatus.LOCKED) {
    throw new ForbiddenException(ACCOUNT_LOCKED);
  }
  if (ownerStatus !== UserStatus.ACTIVE) {
    throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
  }
}
