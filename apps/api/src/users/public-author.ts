import type { Prisma } from '@prisma/client';

/**
 * Автор поста/коментаря у публічних відповідях (P2-13).
 * `isDeleted` замість `deletedAt` — дату видалення акаунта не світимо.
 */
export interface PublicAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  isDeleted: boolean;
}

export const PUBLIC_AUTHOR_SELECT = {
  id: true,
  deletedAt: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

export type PublicAuthorRow = Prisma.UserGetPayload<{
  select: typeof PUBLIC_AUTHOR_SELECT;
}>;

/** Fallback, якщо профілю немає (не має траплятися: профіль створюється разом з User). */
const MISSING_PROFILE_NAME = 'User';

export function toPublicAuthor(authorRow: PublicAuthorRow): PublicAuthor {
  return {
    id: authorRow.id,
    name: authorRow.profile?.displayName ?? MISSING_PROFILE_NAME,
    avatarUrl: authorRow.profile?.avatarUrl ?? null,
    isDeleted: authorRow.deletedAt !== null,
  };
}
