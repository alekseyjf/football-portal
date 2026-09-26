import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type { AdminUser } from '@/lib/api/types';

/** `POST /auth/login/admin`: не-ADMIN → 403 `ADMIN_ONLY`, сесія не створюється. */
export function useAdminLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiPost<{ user: AdminUser }>('/auth/login/admin', data),
  });
}
