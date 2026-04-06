import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type { CreatePostPayload } from '@/lib/api/types';

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePostPayload) => apiPost<unknown>('/posts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
  });
}
