import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    // `req.user` ставить JwtAuthGuard (стоїть раніше); без нього — 403, а не 500 на `undefined.role`
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: Role } }>();
    return user !== undefined && requiredRoles.includes(user.role);
  }
}
