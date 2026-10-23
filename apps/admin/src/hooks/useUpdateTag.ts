import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut, isApiError } from '@/lib/api/http';
import type { AdminTag, UpdateTagRequest } from '@/lib/api/types';
import { adminTagsQueryOptions, updateCachedAdminTags } from './useAdminTags';

/** `PUT /tags/{id}` — перейменувати: назви змінюються, адреса — ні (D45). */
export function useUpdateTag(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateTagRequest) => apiPut<AdminTag>(`/tags/${encodeURIComponent(id)}`, body),
    onSuccess: (updatedTag) => {
      updateCachedAdminTags(queryClient, (tags) => tags.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag)));
      // Назви тегу — і в новинах (чипи у формі редагування)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
    onError: (error) => {
      // Тег видалив інший адмін — список застарів
      if (isApiError(error) && error.code === 'TAG_NOT_FOUND') {
        void queryClient.invalidateQueries({ queryKey: adminTagsQueryOptions().queryKey });
      }
    },
  });
}
