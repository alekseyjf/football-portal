import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { readAccessToken } from '../auth-cookies';
import { ACCESS_TOKEN_ALGORITHM, readJwtSecret } from '../auth.constants';
import type { AccessTokenPayload } from '../auth.service';
import { AuthSessionRepository } from '../sessions/auth-session.repository';

/** Те, що потрапляє в `req.user` (P2-1). */
export interface AuthenticatedUser {
  id: string;
  role: AccessTokenPayload['role'];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private sessionRepository: AuthSessionRepository) {
    super({
      // Читаємо токен з httpOnly cookie, а не з заголовку
      jwtFromRequest: ExtractJwt.fromExtractors([readAccessToken]),
      ignoreExpiration: false,
      // Падає на старті, якщо секрету немає або він закороткий
      secretOrKey: readJwtSecret(),
      algorithms: [ACCESS_TOKEN_ALGORITHM],
    });
  }

  /**
   * На кожен захищений запит: сесія `sid` ще жива (logout / logout-all / блокування / видалення
   * гасять access-токен одразу, а не через 15 хв) + статус і роль власника — одним запитом (2f).
   * Токен без `sid` (виданий до 2f) → 401 → фронт робить refresh і отримує новий.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (!payload.sid) throw new UnauthorizedException();
    const user = await this.sessionRepository.findLiveSessionOwner(
      payload.sid,
      payload.sub,
      new Date(),
    );

    if (!user) throw new UnauthorizedException();
    // LOCKED і DELETED однаково закривають доступ (роль беремо з БД, не з токена)
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        user.status === UserStatus.LOCKED ? 'ACCOUNT_LOCKED' : undefined,
      );
    }
    return { id: user.id, role: user.role };
  }
}
