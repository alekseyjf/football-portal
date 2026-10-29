import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api/http';
import type {
  Comment,
  CommentItem,
  CreateCommentRequest,
  SoftDeletedComment,
} from '@/lib/api/types';

export const commentsQueryKey = (postId: string) =>
  ['comments', 'post', postId] as const;

// Отримати коментарі поста
export function useComments(postId: string) {
  return useQuery({
    queryKey: commentsQueryKey(postId),
    queryFn: () => apiGet<Comment[]>(`/comments/post/${postId}`),
    staleTime: 30 * 1000,
  });
}

// Додати коментар або відповідь
export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentRequest) =>
      apiPost<CommentItem>('/comments', data),
    onSuccess: () => {
      // Інвалідуємо кеш — TanStack автоматично рефетчить коментарі
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    },
  });
}

// Видалити коментар (відповіді кореня API лишає під заглушкою, D27)
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      apiDelete<SoftDeletedComment>(`/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    },
  });
}