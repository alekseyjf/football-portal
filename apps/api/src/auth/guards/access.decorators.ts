import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/*
 * Доступ до роуту: guard-и й опис у Swagger — одним декоратором, щоб вони не розходились (D28).
 * Сесія — httpOnly cookie `access_token` (схема `cookie` у документі OpenAPI).
 */

/** Лише опис у Swagger — для роуту, що ставить guard-и сам (`DELETE /users/me`: порядок з throttler-ом). */
export function ApiAuthRequired() {
  return applyDecorators(
    ApiCookieAuth(),
    ApiUnauthorizedResponse({
      description:
        'Немає живої сесії (або `ACCOUNT_LOCKED`): клієнт робить refresh і повторює запит',
    }),
  );
}

/** Лише залогінений (`JwtAuthGuard`); користувач — `@CurrentUser()`. */
export function AuthRequired() {
  return applyDecorators(UseGuards(JwtAuthGuard), ApiAuthRequired());
}

/** Лише ADMIN: роль `JwtStrategy` бере з БД на кожен запит. */
export function AdminOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.ADMIN),
    ApiAuthRequired(),
    ApiForbiddenResponse({
      description: 'Користувач не ADMIN (`Forbidden resource`)',
    }),
  );
}

/** Гостю теж; із сесією — ще й персональне (`myReaction`): `@OptionalCurrentUser()`. */
export function AuthOptional() {
  return applyDecorators(
    UseGuards(OptionalJwtAuthGuard),
    // `{}` у `security` — «можна й без авторизації»
    ApiSecurity({}),
    ApiCookieAuth(),
  );
}
