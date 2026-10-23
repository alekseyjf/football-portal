import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, isApiError } from '@/lib/api/http';
import type { DeletedTag } from '@/lib/api/types';
import { adminTagsQueryOptions, updateCachedAdminTags } from './useAdminTags';

/** `DELETE /tags/{id}` — назавжди: API прибирає тег з усіх новин, і з чернеток (D45). */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiDelete<DeletedTag>(`/tags/${encodeURIComponent(id)}`),
    onSuccess: (deletedTag) => {
      updateCachedAdminTags(queryClient, (tags) => tags.filter((tag) => tag.id !== deletedTag.id));
      // Тег зник і з новин
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
    onError: (error) => {
      // Тег уже видалив інший адмін — список застарів
      if (isApiError(error) && error.code === 'TAG_NOT_FOUND') {
        void queryClient.invalidateQueries({ queryKey: adminTagsQueryOptions().queryKey });
      }
    },
  });
}
