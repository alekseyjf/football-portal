"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
});

type FormData = z.infer<typeof schema>;

export function AdminLoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const res = await api.post<{ user: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' } }>('/auth/login', data);

      if (res.user.role !== 'ADMIN') {
        setServerError('Access denied. Admin only.');
        return;
      }

      setUser(res.user);
      router.push('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
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
        disabled={isSubmitting}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-semibold transition-colors"
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}