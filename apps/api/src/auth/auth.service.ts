import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    HttpException,
    HttpStatus,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { PrismaService } from '../../prisma/prisma.service';
  import { RegisterDto } from './dto/register.dto';
  import { LoginDto } from './dto/login.dto';
  import * as bcrypt from 'bcrypt';
  
  @Injectable()
  export class AuthService {
    constructor(
      private prisma: PrismaService,
      private jwt: JwtService,
    ) {}
  
    async register(dto: RegisterDto) {
      // Нормалізуємо email — запобігає дублікатам User@mail.com і user@mail.com
      const email = dto.email.toLowerCase().trim();
  
      const exists = await this.prisma.user.findUnique({
        where: { email },
      });
  
      if (exists) throw new ConflictException('Email already in use');
  
      const hashedPassword = await bcrypt.hash(dto.password, 10);
  
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          password: hashedPassword,
        },
        select: { id: true, email: true, name: true, role: true },
      });
  
      return user;
    }
  
    async login(dto: LoginDto) {
      // Нормалізуємо email так само як при реєстрації
      const email = dto.email.toLowerCase().trim();
  
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          password: true,
          accountLockedAt: true,
        },
      });
  
      if (!user) throw new UnauthorizedException('Invalid credentials');

      if (user.accountLockedAt) {
        throw new HttpException('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
      }
  
      const passwordMatch = await bcrypt.compare(dto.password, user.password);
      if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');
  
      const tokens = await this.generateTokens(user.id, user.email, user.role);
      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        ...tokens,
      };
    }
  
    async refreshTokens(userId: string) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          accountLockedAt: true,
        },
      });
      if (!user) throw new UnauthorizedException();
      if (user.accountLockedAt) {
        throw new HttpException('ACCOUNT_LOCKED', HttpStatus.FORBIDDEN);
      }
  
      return this.generateTokens(user.id, user.email, user.role);
    }
  
    private async generateTokens(userId: string, email: string, role: string) {
      const payload = { sub: userId, email, role };
  
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