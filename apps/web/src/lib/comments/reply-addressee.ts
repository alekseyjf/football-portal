import type { CommentReplyTo } from '@/lib/api/types';

/**
 * Кому відповіли — «@Ім'я» перед текстом, з профілю адресата (D27): перейменування оновлює згадку. Акаунт видалено
 * (анонімізовано, D19) чи рядка `User` уже немає — `deletedUserName`. `null` — корінь або відповідь на корінь.
 */
export function replyAddresseeName(
  replyTo: CommentReplyTo | null,
  deletedUserName: string,
): string | null {
  if (!replyTo) return null;
  const { author } = replyTo;
  if (!author || author.isDeleted) return deletedUserName;
  return author.name;
}
