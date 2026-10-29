'use client';

import { LikeButtons } from '@/components/features/LikeButtons';
import { useToggleCommentLike } from '@/hooks/useCommentLike';
import type { CommentItem } from '@/lib/api/types';

type Props = { postId: string; comment: CommentItem };

/** Лайки коментаря — з порції (`likeCount`, `myReaction`), без запиту на кожен коментар (D27). */
export function CommentLikeBar({ postId, comment }: Props) {
  const { mutateAsync: toggleLike, isPending } = useToggleCommentLike(postId);

  return (
    <LikeButtons
      compact
      targetKey={`comment:${comment.id}`}
      likesCount={comment.likeCount}
      myReaction={comment.myReaction}
      isPending={isPending}
      onReact={(action) => toggleLike({ comment, action })}
    />
  );
}
