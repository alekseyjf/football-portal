import type { Prisma } from '@prisma/client';
import type { PublicAuthorDto } from './dto/public-author-response.dto';

/**
 * Автор поста/коментаря у публічних відповідях (P2-13): `isDeleted` замість `deletedAt` —
 * дату видалення акаунта не світимо.
 */
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

export function toPublicAuthor(authorRow: PublicAuthorRow): PublicAuthorDto {
  return {
    id: authorRow.id,
    name: authorRow.profile?.displayName ?? MISSING_PROFILE_NAME,
    avatarUrl: authorRow.profile?.avatarUrl ?? null,
    isDeleted: authorRow.deletedAt !== null,
  };
}
