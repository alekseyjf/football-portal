import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/lib/api/http';
import type { DeletedPost } from '@/lib/api/types';
import { adminPostQueryOptions } from './useAdminPost';

/** `DELETE /posts/{id}` — soft delete: новина зникає з сайту й зі списку адмінки. */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiDelete<DeletedPost>(`/posts/${encodeURIComponent(id)}`),
    onSuccess: (deletedPost) => {
      // Перечитувати видалену нема чого (404); список — застарів
      queryClient.removeQueries({ queryKey: adminPostQueryOptions(deletedPost.id).queryKey });
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
  });
}
