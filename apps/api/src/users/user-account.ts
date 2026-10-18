import type { UserAccountDto } from './dto/user-account-response.dto';
import type { UserAccountRow } from './user.repository';

/** Поточний користувач у відповідях auth (`login`, `register`, `me`). */
export function toUserAccount(accountRow: UserAccountRow): UserAccountDto {
  return {
    id: accountRow.id,
    email: accountRow.email,
    role: accountRow.role,
    name: accountRow.profile?.displayName ?? accountRow.email,
    avatarUrl: accountRow.profile?.avatarUrl ?? null,
  };
}
