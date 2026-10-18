"use client";
import { create } from 'zustand';
import type { UserAccount } from '@/lib/api/types';

interface AuthState {
  user: UserAccount | null;
  setUser: (user: UserAccount | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));