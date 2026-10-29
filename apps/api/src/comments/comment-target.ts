import { BadRequestException } from '@nestjs/common';
import type { CommentListScope } from './comment-cursor';

/** Що коментують: новина або матч — рівно одне (P4-1). */
export type CommentTargetRef =
  | { kind: 'post'; postId: string }
  | { kind: 'match'; matchId: string };

/**
 * Рівно одна ціль — і в тілі `POST /comments`, і в `GET /comments?postId=|matchId=`.
 * `null` = не передано: `@IsOptional` пропускає `null` без валідації (так само, як `publishedAt: null` у постах).
 */
export function readCommentTargetRef(ids: {
  postId?: string | null;
  matchId?: string | null;
}): CommentTargetRef {
  const postId = ids.postId ?? null;
  const matchId = ids.matchId ?? null;
  if (postId !== null && matchId === null) return { kind: 'post', postId };
  if (matchId !== null && postId === null) return { kind: 'match', matchId };
  throw new BadRequestException('COMMENT_TARGET_INVALID');
}

/** Список коренів цілі — для курсора (`comment-cursor.ts`). */
export function rootListScope(targetRef: CommentTargetRef): CommentListScope {
  return targetRef.kind === 'post'
    ? `post:${targetRef.postId}`
    : `match:${targetRef.matchId}`;
}
