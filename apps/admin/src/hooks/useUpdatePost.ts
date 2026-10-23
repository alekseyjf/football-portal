import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api/http';
import type { AdminPost, UpdatePostRequest } from '@/lib/api/types';

/** `PUT /posts/{id}`: відповідь — без текстів, тож форма після збереження перечитує новину (D47). */
export function useUpdatePost(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePostRequest) => apiPut<AdminPost>(`/posts/${encodeURIComponent(id)}`, body),
    onSuccess: () => {
      // Список і сама новина застаріли: заголовки, статус, дата. Не чекаємо: форма перечитує новину сама
      // (`fetchFreshAdminPost` підхопить запит, який почне інвалідація)
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    },
  });
}
