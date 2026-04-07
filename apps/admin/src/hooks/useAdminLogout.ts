'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api/http';
import { useAuthStore } from '@/store/auth.store';

export function useAdminLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: () => apiPost<{ message: string }>('/auth/logout', {}),
    onSettled: () => {
      qc.clear();
      clearUser();
      router.push('/login');
      router.refresh();
    },
  });
}
