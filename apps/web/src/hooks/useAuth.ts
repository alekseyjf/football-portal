import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost, isApiError } from '@/lib/api/http';
import type { User } from '@/lib/api/types';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/** `null` — гість: access немає, і refresh теж не допоміг. */
async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { user } = await apiGet<{ user: User }>('/auth/me');
    return user;
  } catch (error) {
    // 401 — сесії немає; 403 — refresh відхилив заблокований акаунт (`ACCOUNT_LOCKED`).
    // Решта (429, мережа, 5xx) — не доказ виходу: помилка, попередні дані лишаються
    if (isApiError(error) && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

const AUTH_ME_MAX_RETRIES = 2;

/** Джерело правди про поточного користувача (відновлення сесії після F5). */
export function authMeQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount) => failureCount < AUTH_ME_MAX_RETRIES,
    retryDelay: (attemptIndex, error) =>
      isApiError(error) && error.retryAfterSeconds
        ? error.retryAfterSeconds * 1000
        : 1000 * 2 ** attemptIndex,
  });
}

export function useAuthQuery() {
  return useQuery(authMeQueryOptions());
}

/**
 * Записати поточного користувача в кеш `me`. Спершу скасовуємо `me`, що ще в дорозі:
 * його відповідь (відправлена до login / logout) інакше перезапише свіже значення.
 */
async function writeCurrentUser(queryClient: QueryClient, user: User | null) {
  await queryClient.cancelQueries({ queryKey: authKeys.me });
  queryClient.setQueryData(authKeys.me, user);
}

/**
 * Користувач вийшов (logout або refresh відхилено): кеш `me` → `null`,
 * «мої» реакції в лайках перечитуємо вже як гість.
 */
export async function markSignedOut(queryClient: QueryClient) {
  await writeCurrentUser(queryClient, null);
  void queryClient.invalidateQueries({ queryKey: ['likes'] });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiPost<{ user: User; message: string }>('/auth/login', data),
    onSuccess: async ({ user }) => {
      await writeCurrentUser(queryClient, user);
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
    // І при помилці: локально користувач однаково виходить
    onSettled: () => markSignedOut(queryClient),
  });
}
