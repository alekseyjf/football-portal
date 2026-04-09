'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useLogoutMutation } from '@/hooks/useAuth';

export function NavbarClient() {
  const router = useRouter();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const { user, logout } = useAuthStore();
  const { mutateAsync: logoutApi } = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // cookies можуть бути вже недійсні — все одно чистимо локальний стан
    } finally {
      logout();
      router.push('/');
      router.refresh();
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">
          {user.name}
          {user.role === 'ADMIN' && (
            <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
              {tAuth('adminBadge')}
            </span>
          )}
        </span>
        {user.role === 'ADMIN' && (
          <a
            href={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            {tNav('adminPanel')}
          </a>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
        >
          {tNav('logout')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/auth/login"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        {tNav('signIn')}
      </Link>
      <Link
        href="/auth/register"
        className="text-sm bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg transition-colors"
      >
        {tNav('register')}
      </Link>
    </div>
  );
}
