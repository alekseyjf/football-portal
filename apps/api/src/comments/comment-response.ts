import { toPublicAuthor } from '../users/public-author';
import type { PublicCommentFlat } from './comment-thread.util';
import type { CommentNodeRow } from './comment.repository';

/** Автор — через `toPublicAuthor` (P2-13): видалений акаунт → `isDeleted`, без email / дат. */
export function toPublicComment(commentRow: CommentNodeRow): PublicCommentFlat {
  return { ...commentRow, author: toPublicAuthor(commentRow.author) };
}

/** `DELETE /comments/:id` — soft delete разом з гілкою відповідей (P4-5). */
export interface SoftDeletedComment {
  id: string;
  deletedCount: number;
}

/** `DELETE /comments/:id/purge` і `…/purge-thread` (P4-6, P4-7). */
export interface PurgedComment {
  id: string;
  purgedCount: number;
}
