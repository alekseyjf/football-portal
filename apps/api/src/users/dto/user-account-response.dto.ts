import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/** Поточний користувач — лише у відповідях auth (`register`, `login`, `me`): тут є його email. */
export class UserAccountDto {
  id!: string;
  email!: string;

  @ApiProperty({ enum: Role, enumName: 'UserRole' })
  role!: Role;

  /** Ім'я з профілю */
  name!: string;
  avatarUrl!: string | null;
}
