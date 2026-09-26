import { Module } from '@nestjs/common';
import { AuthSessionsModule } from '../../auth/sessions/auth-sessions.module';
import { SecurityModule } from '../../security/security.module';
import { UsersModule } from '../users.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * Дії над акаунтами (`/users`). Окремо від листового `UsersModule`:
 * його імпортує `SecurityModule`, тож `UserService` там дав би цикл.
 * `JwtStrategy` для guard-ів реєструє `AuthModule` (passport — глобальний реєстр стратегій).
 */
@Module({
  imports: [UsersModule, SecurityModule, AuthSessionsModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserManagementModule {}
