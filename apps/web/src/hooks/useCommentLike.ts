import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type {
  CommentItem,
  LikeStats,
  LikeType,
  ToggleLikeRequest,
} from '@/lib/api/types';
import {
  likeStatsOfComment,
  updateCommentInPages,
  withLikeStats,
  type CommentPages,
} from '@/lib/comments/comment-pages';
import { commentsQueryKey } from './useComments';
import { applyOptimisticLikeToggle } from './useLikes';

type CommentReaction = { comment: CommentItem; action: LikeType };

/**
 * Лайк коментаря — у кеші порції, звідки він прийшов (D27): без окремого запиту статистики на кожен коментар.
 * Оптимістично, як лайк новини; помилка — повертаємо голос, з яким натискали, відповідь — ставимо голос з неї.
 */
export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();

  const setCommentLikeStats = (
    commentId: string,
    nextStats: (comment: CommentItem) => LikeStats,
  ) => {
    // Коментар — у порції коренів або гілки: префікс новини знаходить обидві
    queryClient.setQueriesData<CommentPages>(
      { queryKey: commentsQueryKey(postId) },
      (data) =>
        data &&
        updateCommentInPages(data, commentId, (comment) =>
          withLikeStats(comment, nextStats(comment)),
        ),
    );
  };

  return useMutation({
    mutationFn: ({ comment, action }: CommentReaction) =>
      apiPost<LikeStats>('/likes', {
        targetType: 'comment',
        targetId: comment.id,
        action,
      } satisfies ToggleLikeRequest),
    onMutate: ({ comment, action }) => {
      setCommentLikeStats(comment.id, (current) =>
        applyOptimisticLikeToggle(likeStatsOfComment(current), action),
      );
      return { previous: likeStatsOfComment(comment) };
    },
    onError: (_error, { comment }, context) => {
      if (context) setCommentLikeStats(comment.id, () => context.previous);
    },
    onSuccess: (stats, { comment }) => {
      setCommentLikeStats(comment.id, () => stats);
    },
  });
}
