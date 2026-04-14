import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type { User } from '@/lib/api/types';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiPost<{ user: User; message: string }>('/auth/login', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['likes'] });
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      apiPost<{ message?: string }>('/auth/register', data),
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout', {}),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
