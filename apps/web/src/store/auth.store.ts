import { create } from 'zustand';
import type { User } from '@/lib/api/types';

/**
 * Дзеркало `useAuthQuery` (`GET /auth/me`) для компонентів. Єдиний запис — `AuthSessionSync`;
 * login / logout змінюють кеш запиту, а не store.
 */
interface AuthState {
  user: User | null;
  /** `true`, поки перший `GET /auth/me` не відповів — не показувати «Увійти» залогіненому. */
  isLoading: boolean;
  syncSession: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  syncSession: (user) => set({ user, isLoading: false }),
}));
