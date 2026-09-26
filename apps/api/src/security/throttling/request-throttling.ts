import { applyDecorators } from '@nestjs/common';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * Ліміт на IP клієнта. За reverse proxy коректний лише з `TRUST_PROXY`,
 * інакше всі користувачі мають IP проксі й ділять один ліміт.
 */
export const IP_THROTTLER = 'ip';

/**
 * Ліміт на акаунт — захист від розподіленого перебору пароля одного акаунта
 * з багатьох IP, який ліміт на IP не бачить.
 * Ціна: чужими запитами можна тимчасово заблокувати вхід жертві — тому поріг помірний.
 */
export const ACCOUNT_THROTTLER = 'account';

/**
 * Ключ ліміту на акаунт: id автентифікованого користувача (guard `JwtAuthGuard` має стояти
 * **перед** `ThrottlerGuard`) або email з тіла запиту, нормалізований як у `AuthService`
 * (інакше `A@b.c` і `a@b.c` мали б окремі ліміти). Тіло ще не провалідоване — guard-и
 * працюють до `ValidationPipe`. Сирий ключ не зберігається: throttler хешує його SHA-256.
 */
export function trackAccount(request: Record<string, any>): string {
  const user = request.user as AuthenticatedUser | undefined;
  if (user?.id) return `user:${user.id}`;

  const body = request.body as { email?: unknown } | undefined;
  if (typeof body?.email === 'string') {
    return `email:${body.email.toLowerCase().trim()}`;
  }
  return `ip:${String(request.ip)}`;
}

/** 10 спроб за хвилину з IP; 10 за 15 хв на одну адресу — ~1000 паролів на добу максимум. */
export const LoginThrottle = () =>
  Throttle({
    [IP_THROTTLER]: { limit: 10, ttl: minutes(1) },
    [ACCOUNT_THROTTLER]: { limit: 10, ttl: minutes(15) },
  });

/** Масова реєстрація ботів. NAT (офіс, університет) — тому не жорсткіше. */
export const RegisterThrottle = () =>
  applyDecorators(
    Throttle({ [IP_THROTTLER]: { limit: 5, ttl: minutes(10) } }),
    SkipThrottle({ [ACCOUNT_THROTTLER]: true }),
  );

/**
 * Refresh-токен — 256 біт, перебір неможливий; ліміт — проти флуду.
 * Щедрий: кожна вкладка рефрешить раз на 15 хв, плюс гонки вкладок (P2-5).
 * Рахуються лише запити з refresh-cookie — `RefreshThrottlerGuard`.
 */
export const RefreshThrottle = () =>
  applyDecorators(
    Throttle({ [IP_THROTTLER]: { limit: 30, ttl: minutes(1) } }),
    SkipThrottle({ [ACCOUNT_THROTTLER]: true }),
  );

/**
 * Дії з підтвердженням пароля (`DELETE /users/me`): інакше це оракул для перебору пароля
 * з украденим access-cookie. Ключ — id користувача, IP не важливий.
 */
export const PasswordConfirmationThrottle = () =>
  applyDecorators(
    Throttle({ [ACCOUNT_THROTTLER]: { limit: 5, ttl: minutes(15) } }),
    SkipThrottle({ [IP_THROTTLER]: true }),
  );
