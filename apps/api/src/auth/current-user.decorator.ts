import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

/** `req.user` ставить `JwtStrategy.validate` — через `JwtAuthGuard` або `OptionalJwtAuthGuard`. */
type RequestWithUser = { user?: AuthenticatedUser };

function readRequestUser(
  context: ExecutionContext,
): AuthenticatedUser | undefined {
  return context.switchToHttp().getRequest<RequestWithUser>().user;
}

/**
 * Користувач роуту за `JwtAuthGuard` — замість `req.user as AuthenticatedUser` у контролерах (D29).
 * Без guard-а користувача в запиті немає — це помилка в коді, а не гість: 500 і стек у лозі,
 * а не тихий `undefined` у сервісі.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = readRequestUser(context);
    if (!user) {
      throw new Error('@CurrentUser() requires JwtAuthGuard on the route');
    }
    return user;
  },
);

/** Для роутів з `OptionalJwtAuthGuard`: гість → `undefined`. */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    readRequestUser(context),
);
