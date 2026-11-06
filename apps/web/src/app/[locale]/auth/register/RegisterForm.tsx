'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useRegisterMutation } from '@/hooks/useAuth';
import { useFormResolver } from '@/hooks/useFormResolver';
import {
  registerFormSchema,
  type RegisterFormValues,
} from '@football-portal/validation/forms';
import { isApiError } from '@/lib/api/http';

// Винесли стилі інпута щоб не дублювати
const inputClass = (hasError: boolean) =>
  `w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 
   outline-none transition-colors border ${
     hasError
       ? 'border-red-500 focus:border-red-400'
       : 'border-gray-700 focus:border-green-500'
   }`;

export function RegisterForm() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutateAsync: registerUser, isPending } = useRegisterMutation();

  const resolver = useFormResolver(registerFormSchema);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver,
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      router.push('/auth/login');
    } catch (err) {
      setServerError(registerErrorMessage(err));
    }
  };

  const registerErrorMessage = (error: unknown): string => {
    if (!isApiError(error)) return t('genericError');
    if (error.code === 'EMAIL_TAKEN') return t('emailInUse');
    if (error.code === 'EMAIL_BLOCKED') return t('emailBlocked');
    if (error.code === 'EMAIL_DOMAIN_NOT_ALLOWED') {
      return t('emailDomainNotAllowed');
    }
    if (error.code === 'TOO_MANY_REQUESTS') return t('tooManyAttempts');
    return t('genericError');
  };

  return (
    // `noValidate`: помилки полів — наші, мовою сторінки; підказку браузера до `type="email"` він пише мовою браузера (M1.9)
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="bg-gray-900 rounded-2xl p-8 space-y-5"
    >
      {serverError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">{serverError}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">{t('name')}</label>
        <input
          {...register('name')}
          placeholder={t('namePlaceholder')}
          className={inputClass(!!errors.name)}
        />
        {errors.name && (
          <p className="text-red-400 text-xs">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">
          {t('email')}
        </label>
        <input
          {...register('email')}
          type="email"
          placeholder="you@example.com"
          className={inputClass(!!errors.email)}
        />
        {errors.email && (
          <p className="text-red-400 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">
          {t('password')}
        </label>
        <input
          {...register('password')}
          type="password"
          placeholder="••••••••"
          className={inputClass(!!errors.password)}
        />
        {errors.password && (
          <p className="text-red-400 text-xs">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">
          {t('confirmPassword')}
        </label>
        <input
          {...register('confirmPassword')}
          type="password"
          placeholder="••••••••"
          className={inputClass(!!errors.confirmPassword)}
        />
        {errors.confirmPassword && (
          <p className="text-red-400 text-xs">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 
          disabled:cursor-not-allowed rounded-lg px-4 py-3 font-semibold transition-colors"
      >
        {isPending ? t('creating') : t('createAccount')}
      </button>

      <p className="text-center text-sm text-gray-400">
        {t('hasAccount')}{' '}
        <Link
          href="/auth/login"
          className="text-green-400 hover:text-green-300"
        >
          {t('signInLink')}
        </Link>
      </p>
    </form>
  );
}
