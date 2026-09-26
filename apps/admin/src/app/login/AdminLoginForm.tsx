"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAdminLogin } from '@/hooks/useAdminLogin';
import { useAuthStore } from '@/store/auth.store';
import {
  loginFormSchema,
  type LoginFormValues,
} from '@football-portal/validation/forms';
import { isApiError } from '@/lib/api/http';

function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong';
  if (error.code === 'ACCOUNT_LOCKED') return 'This account is locked.';
  // API перевіряє роль до створення сесії — токенів не видано
  if (error.code === 'ADMIN_ONLY') return 'Access denied. Admin only.';
  if (error.code === 'TOO_MANY_REQUESTS') {
    return 'Too many attempts. Please try again later.';
  }
  if (error.status === 401) return 'Invalid email or password.';
  return error.message;
}

export function AdminLoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutateAsync: login, isPending } = useAdminLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      // Не-ADMIN отримує 403 `ADMIN_ONLY` від API ще до створення сесії
      const res = await login(data);
      setUser(res.user);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setServerError(loginErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-900 rounded-2xl p-8 space-y-5">
      {serverError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{serverError}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Email</label>
        <input
          {...register('email')}
          type="email"
          placeholder="admin@example.com"
          className={`w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${errors.email ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`}
        />
        {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Password</label>
        <input
          {...register('password')}
          type="password"
          placeholder="••••••••"
          className={`w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none border transition-colors ${errors.password ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`}
        />
        {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-semibold transition-colors"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
