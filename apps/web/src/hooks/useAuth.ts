import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost, isApiError } from '@/lib/api/http';
import type {
  AuthUserResponse,
  CurrentUserResponse,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  UserAccount,
} from '@/lib/api/types';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * `null` — гість. Без жодної cookie сесії API одразу відповідає `{ user: null }`; 401 приходить,
 * лише коли є refresh-cookie, — `apiGet` тоді сам робить refresh і повторює запит.
 */
async function fetchCurrentUser(): Promise<UserAccount | null> {
  try {
    const { user } = await apiGet<CurrentUserResponse>('/auth/me');
    return user;
  } catch (error) {
    // 401 — refresh не допоміг: сесії вже немає; 403 — refresh відхилив заблокований акаунт
    // (`ACCOUNT_LOCKED`). Решта (429, мережа, 5xx) — не доказ виходу: помилка, дані лишаються
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
async function writeCurrentUser(
  queryClient: QueryClient,
  user: UserAccount | null,
) {
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
    mutationFn: (data: LoginRequest) =>
      apiPost<AuthUserResponse>('/auth/login', data),
    onSuccess: async ({ user }) => {
      await writeCurrentUser(queryClient, user);
      void queryClient.invalidateQueries({ queryKey: ['likes'] });
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      apiPost<AuthUserResponse>('/auth/register', data),
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<MessageResponse>('/auth/logout', {}),
    // І при помилці: локально користувач однаково виходить
    onSettled: () => markSignedOut(queryClient),
  });
}
