import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from '../../users/user.repository';
import { readAccessToken } from '../auth-cookies';
import { ACCESS_TOKEN_ALGORITHM, readJwtSecret } from '../auth.constants';
import type { AccessTokenPayload } from '../auth.service';

/** Те, що потрапляє в `req.user` (P2-1). */
export interface AuthenticatedUser {
  id: string;
  role: AccessTokenPayload['role'];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userRepository: UserRepository) {
    super({
      // Читаємо токен з httpOnly cookie, а не з заголовку
      jwtFromRequest: ExtractJwt.fromExtractors([readAccessToken]),
      ignoreExpiration: false,
      // Падає на старті, якщо секрету немає або він закороткий
      secretOrKey: readJwtSecret(),
      algorithms: [ACCESS_TOKEN_ALGORITHM],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findAccessById(payload.sub);

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
