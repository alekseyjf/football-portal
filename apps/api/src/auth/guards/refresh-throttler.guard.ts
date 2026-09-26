import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { readRefreshToken } from '../auth-cookies';

/**
 * Ліміт `POST /auth/refresh` рахує лише запити з refresh-cookie.
 * Фронт робить refresh на кожен 401 (у т.ч. `GET /auth/me` анонімного відвідувача після F5),
 * і без цього анонімні відвідувачі за одним NAT вичерпували б ліміт на IP для залогінених.
 * Запит без cookie — миттєвий 401 без звернення до БД, лімітувати нема чого.
 */
@Injectable()
export class RefreshThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return Promise.resolve(!readRefreshToken(request));
  }
}
