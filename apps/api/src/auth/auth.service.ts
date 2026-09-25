import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { toUserAccount } from '../users/user-account';
import { UserRepository } from '../users/user.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 10;

/** Payload access-токена (P2-1): лише id і роль. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

@Injectable()
export class AuthService {
  /** Хеш для порівняння, коли email не знайдено — вирівнює час відповіді (P2-2). */
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private userRepository: UserRepository,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
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

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const credentials = await this.userRepository.findCredentialsByEmail(email);

    // Порівнюємо пароль завжди, щоб час відповіді не видавав, чи існує email.
    const passwordMatches = await bcrypt.compare(
      dto.password,
      credentials?.passwordHash ?? (await this.getDummyPasswordHash()),
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

    const account = await this.userRepository.findAccountById(credentials.id);
    if (!account) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens({
      sub: account.id,
      role: account.role,
    });
    return { user: toUserAccount(account), ...tokens };
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= bcrypt.hash(
      'dummy-password-for-timing',
      PASSWORD_HASH_ROUNDS,
    );
    return this.dummyPasswordHash;
  }

  // TODO(Фаза 2b): refresh → opaque-токен в AuthSession, ротація.
  private async generateTokens(payload: AccessTokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}

/** Email завжди в нижньому регістрі без пробілів. */
function normalizeEmail(rawEmail: string): string {
  return rawEmail.toLowerCase().trim();
}
