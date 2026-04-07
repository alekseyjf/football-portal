"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useLoginMutation } from '@/hooks/useAuth';

// Схема валідації — один раз описали, і тип і валідація готові
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const { mutateAsync: login, isPending } = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const res = await login(data);
      setUser(res.user);
      router.push('/');
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-900 rounded-2xl p-8 space-y-5">

      {/* Server Error — показуємо помилку від API */}
      {serverError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{serverError}</p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Email</label>
        <input
          {...register('email')}
          type="email"
          placeholder="you@example.com"
          className={`w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 
            outline-none transition-colors
            ${errors.email
              ? 'border border-red-500 focus:border-red-400'
              : 'border border-gray-700 focus:border-green-500'
            }`}
        />
        {errors.email && (
          <p className="text-red-400 text-xs">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Password</label>
        <input
          {...register('password')}
          type="password"
          placeholder="••••••••"
          className={`w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 
            outline-none transition-colors
            ${errors.password
              ? 'border border-red-500 focus:border-red-400'
              : 'border border-gray-700 focus:border-green-500'
            }`}
        />
        {errors.password && (
          <p className="text-red-400 text-xs">{errors.password.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 
          disabled:cursor-not-allowed rounded-lg px-4 py-3 font-semibold 
          transition-colors"
      >
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-green-400 hover:text-green-300">
          Register
        </Link>
      </p>
    </form>
  );
}