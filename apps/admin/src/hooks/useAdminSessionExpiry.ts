'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { onSessionExpired } from '@/lib/api/http';
import { useAuthStore } from '@/store/auth.store';
import { useLeaveGuard } from './useUnsavedChangesGuard';

/**
 * Refresh відхилено (сесію відкликано / прострочено / акаунт заблоковано) → на логін. Крім форми з незбереженими
 * змінами (D50): текст важливіший за перехід — форма лишається й просить увійти в новій вкладці й зберегти ще раз.
 */
export function useAdminSessionExpiry() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearUser = useAuthStore((state) => state.logout);
  const leaveGuard = useLeaveGuard();

  useEffect(
    () =>
      onSessionExpired(() => {
        if (leaveGuard.hasUnsavedChanges()) return;
        queryClient.clear();
        clearUser();
        router.replace('/login');
      }),
    [queryClient, router, clearUser, leaveGuard],
  );
}
