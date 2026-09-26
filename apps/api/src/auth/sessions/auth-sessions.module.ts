import { Module } from '@nestjs/common';
import { AuthSessionRepository } from './auth-session.repository';

/**
 * Окремий модуль, щоб `security/` (2c) і `users/` (2d) могли відкликати сесії
 * без імпорту всього `AuthModule` (і без циклу `AuthModule` ↔ `UsersModule`).
 */
@Module({
  providers: [AuthSessionRepository],
  exports: [AuthSessionRepository],
})
export class AuthSessionsModule {}
