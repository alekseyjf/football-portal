import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionService } from './sessions/auth-session.service';
import { AuthSessionsModule } from './sessions/auth-sessions.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    AuthSessionsModule,
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
