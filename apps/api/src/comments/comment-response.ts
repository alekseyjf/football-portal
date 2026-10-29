import type { LikeType } from '@prisma/client';
import { toPublicAuthor } from '../users/public-author';
import type { PublicCommentFlat } from './comment-thread.util';
import type { CommentItemRow, CommentNodeRow } from './comment.repository';
import type {
  CommentItemDto,
  CommentReplyToDto,
} from './dto/comment-response.dto';

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

/** Коментар порції (D27): видалений корінь у списку — заглушка без тексту й автора. */
export function toCommentItem(
  commentRow: CommentItemRow,
  myReaction: LikeType | null,
): CommentItemDto {
  const isDeleted = commentRow.deletedAt !== null;
  return {
    id: commentRow.id,
    parentId: commentRow.parentId,
    content: isDeleted ? null : commentRow.content,
    author: isDeleted ? null : toPublicAuthor(commentRow.author),
    isDeleted,
    createdAt: commentRow.createdAt,
    editedAt: commentRow.editedAt,
    likeCount: commentRow.likeCount,
    myReaction,
    replyCount: commentRow.replyCount,
    replyTo: toReplyTo(commentRow),
  };
}

/** Колонки адресата обнуляються незалежно (`ON DELETE SET NULL`): лишається те, що є. */
function toReplyTo(commentRow: CommentItemRow): CommentReplyToDto | null {
  if (commentRow.replyToCommentId === null && commentRow.replyToUser === null) {
    return null;
  }
  return {
    commentId: commentRow.replyToCommentId,
    author: commentRow.replyToUser
      ? toPublicAuthor(commentRow.replyToUser)
      : null,
  };
}
