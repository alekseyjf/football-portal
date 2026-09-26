'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { onSessionExpired } from '@/lib/api/http';
import { useAuthStore } from '@/store/auth.store';

/** Refresh відхилено (сесію відкликано / прострочено / акаунт заблоковано) → на логін. */
export function useAdminSessionExpiry() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearUser = useAuthStore((state) => state.logout);

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        clearUser();
        router.replace('/login');
      }),
    [queryClient, router, clearUser],
  );
}
