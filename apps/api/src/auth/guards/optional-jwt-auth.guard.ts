import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Дозволяє публічний доступ; якщо є валідний access_token у cookie — заповнює req.user.
 * Для ендпоінтів на кшталт статистики лайків (показати «мій» голос лише залогіненим).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request?.cookies?.['access_token']) {
      return true;
    }
    try {
      await super.canActivate(context);
      return true;
    } catch {
      return true;
    }
  }

  handleRequest<TUser>(error: Error | undefined, user: TUser): TUser | undefined {
    if (error || !user) return undefined;
    return user;
  }
}
