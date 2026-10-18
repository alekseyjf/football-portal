import { Module } from '@nestjs/common';
import { AuthCookieService } from '../auth-cookies';
import { AuthSessionRepository } from './auth-session.repository';

/**
 * Сесії й cookies з їхніми токенами. Окремий модуль, щоб `security/` (2c) і `users/` (2d)
 * могли відкликати сесії й чистити cookies без імпорту всього `AuthModule`
 * (і без циклу `AuthModule` ↔ `UsersModule`).
 */
@Module({
  providers: [AuthSessionRepository, AuthCookieService],
  exports: [AuthSessionRepository, AuthCookieService],
})
export class AuthSessionsModule {}
