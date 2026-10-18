import { toPublicAuthor } from '../users/public-author';
import type { PublicCommentFlat } from './comment-thread.util';
import type { CommentNodeRow } from './comment.repository';

/**
 * Поля — явно, не spread рядка: нове поле в select не потрапить у відповідь непомітно (Rule 5).
 * Автор — через `toPublicAuthor` (P2-13): видалений акаунт → `isDeleted`, без email / дат.
 */
export function toPublicComment(commentRow: CommentNodeRow): PublicCommentFlat {
  return {
    id: commentRow.id,
    content: commentRow.content,
    pinnedAt: commentRow.pinnedAt,
    createdAt: commentRow.createdAt,
    parentId: commentRow.parentId,
    author: toPublicAuthor(commentRow.author),
  };
}
