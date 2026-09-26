import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmailBlocklistService } from '../security/email-blocklist/email-blocklist.service';
import { isReservedEmail } from '../users/deleted-account';
import { toUserAccount } from '../users/user-account';
import { UserRepository } from '../users/user.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { SessionClientContext } from './session-client-context';
import { AuthSessionService } from './sessions/auth-session.service';

const PASSWORD_HASH_ROUNDS = 10;

/** Payload access-токена (P2-1): id, роль і сесія. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  /**
   * Session id = `AuthSession.familyId` (2f). Саме `sid` (OIDC), а не `jti`: `jti` — id окремого
   * токена, а тут усі access-токени однієї сесії (після кожної ротації) мають спільне значення.
   */
  sid: string;
}

/** Обмеження логіну (адмінка — лише ADMIN). */
export interface LoginRequirements {
  requiredRole?: Role;
}

/** Логін в адмінку не-адміном: сесія не створюється (2f). */
const ADMIN_ONLY = 'ADMIN_ONLY';

@Injectable()
export class AuthService {
  /** Хеш для порівняння, коли email не знайдено — вирівнює час відповіді (P2-2). */
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private userRepository: UserRepository,
    private sessionService: AuthSessionService,
    private emailBlocklist: EmailBlocklistService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    // Простір адрес анонімізованих акаунтів (див. deleted-account.ts)
    if (isReservedEmail(email)) {
      throw new BadRequestException('Email domain is not allowed');
    }
    // Пошта видаленого акаунта (admin — назавжди, self — 30 днів). Окремий код, а не 409 — рішення 2d
    if (await this.emailBlocklist.isBlocked(email, new Date())) {
      throw new ForbiddenException('EMAIL_BLOCKED');
    }
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);

    try {
      const account = await this.userRepository.createWithProfile({
        email,
        passwordHash,
        displayName: dto.name.trim(),
      });
      return toUserAccount(account);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  /**
   * `previousRefreshToken` — cookie попереднього входу з цього ж браузера:
   * відкликаємо, щоб повторні логіни не накопичували живі сесії.
   */
  async login(
    dto: LoginDto,
    client: SessionClientContext,
    previousRefreshToken: string | undefined,
    requirements: LoginRequirements = {},
  ) {
    const email = normalizeEmail(dto.email);
    const credentials = await this.userRepository.findCredentialsByEmail(email);

    // Порівнюємо пароль завжди, щоб час відповіді не видавав, чи існує email.
    // `||`, а не `??`: у видаленого акаунта хеш порожній, і compare з ним миттєвий.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      credentials?.passwordHash || (await this.getDummyPasswordHash()),
    );
    if (
      !credentials ||
      !passwordMatches ||
      credentials.status === UserStatus.DELETED
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Статус блокування розкриваємо лише тому, хто знає пароль.
    if (credentials.status === UserStatus.LOCKED) {
      throw new HttpException('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
    }

    // Після пароля (роль не розкриваємо без нього) і ДО `endSession` / `startSession`:
    // не-адмін не отримує токенів і не втрачає сесію, з якою вже зайшов на сайт.
    if (
      requirements.requiredRole &&
      credentials.role !== requirements.requiredRole
    ) {
      throw new ForbiddenException(ADMIN_ONLY);
    }

    const account = await this.userRepository.findAccountById(credentials.id);
    if (!account) throw new UnauthorizedException('Invalid credentials');

    await this.sessionService.endSession(previousRefreshToken);
    const tokens = await this.sessionService.startSession(account, client);
    return { user: toUserAccount(account), tokens };
  }

  /** `GET /auth/me`: статус уже перевірив `JwtStrategy`. */
  async getCurrentUser(userId: string) {
    const account = await this.userRepository.findAccountById(userId);
    if (!account) throw new UnauthorizedException();
    return toUserAccount(account);
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= bcrypt.hash(
      'dummy-password-for-timing',
      PASSWORD_HASH_ROUNDS,
    );
    return this.dummyPasswordHash;
  }
}

/** Email завжди в нижньому регістрі без пробілів. */
function normalizeEmail(rawEmail: string): string {
  return rawEmail.toLowerCase().trim();
}
