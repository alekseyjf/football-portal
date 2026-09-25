import type { Role } from '@prisma/client';
import type { UserAccountRow } from './user.repository';

/** Поточний користувач у відповідях auth (`login`, `register`, `me`). */
export interface UserAccount {
  id: string;
  email: string;
  role: Role;
  name: string;
  avatarUrl: string | null;
}

export function toUserAccount(accountRow: UserAccountRow): UserAccount {
  return {
    id: accountRow.id,
    email: accountRow.email,
    role: accountRow.role,
    name: accountRow.profile?.displayName ?? accountRow.email,
    avatarUrl: accountRow.profile?.avatarUrl ?? null,
  };
}
