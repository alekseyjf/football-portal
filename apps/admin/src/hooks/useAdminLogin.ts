import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/http';
import type { AuthUserResponse, LoginRequest } from '@/lib/api/types';

/** `POST /auth/login/admin`: не-ADMIN → 403 `ADMIN_ONLY`, сесія не створюється. */
export function useAdminLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      apiPost<AuthUserResponse>('/auth/login/admin', data),
  });
}
