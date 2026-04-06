import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

import { ROLES_KEY } from './roles.guard';