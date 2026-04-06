import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type { AdminUser } from '@/lib/api/types';

export function useAdminLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiPost<{ user: AdminUser }>('/auth/login', data),
  });
}
