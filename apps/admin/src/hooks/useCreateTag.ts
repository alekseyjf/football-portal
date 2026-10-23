import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, isApiError } from '@/lib/api/http';
import type { AdminTag, CreateTagRequest } from '@/lib/api/types';
import { adminTagsQueryOptions, updateCachedAdminTags } from './useAdminTags';

/** `POST /tags`: 409 `TAG_SLUG_TAKEN` — тег з такою адресою вже є (D45). */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTagRequest) => apiPost<AdminTag>('/tags', body),
    // Список міг перечитатись, поки йшов запит, і вже мати новий тег — без дубля
    onSuccess: (createdTag) =>
      updateCachedAdminTags(queryClient, (tags) => [...tags.filter((tag) => tag.id !== createdTag.id), createdTag]),
    onError: (error) => {
      // Тег з цією адресою щойно створив інший адмін — перечитаний список назве його біля поля адреси
      if (isApiError(error) && error.code === 'TAG_SLUG_TAKEN') {
        void queryClient.invalidateQueries({ queryKey: adminTagsQueryOptions().queryKey });
      }
    },
  });
}
