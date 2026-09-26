'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authKeys, markSignedOut, useAuthQuery } from '@/hooks/useAuth';
import { onSessionExpired } from '@/lib/api/http';
import type { User } from '@/lib/api/types';
import { useAuthStore } from '@/store/auth.store';

/** Тримає `useAuthStore` у згоді з `GET /auth/me` і реагує на відхилений refresh. */
export function AuthSessionSync() {
  const queryClient = useQueryClient();
  const { data: currentUser, isPending } = useAuthQuery();
  const syncSession = useAuthStore((state) => state.syncSession);

  useEffect(() => {
    // Помилка першого запиту (мережа) — теж кінець очікування: показуємо як гостя
    if (!isPending) syncSession(currentUser ?? null);
  }, [currentUser, isPending, syncSession]);

  useEffect(
    () =>
      onSessionExpired(() => {
        // Гість після F5 теж отримує 401 від refresh — міняти нічого
        if (queryClient.getQueryData<User | null>(authKeys.me)) {
          void markSignedOut(queryClient);
        }
      }),
    [queryClient],
  );

  return null;
}
