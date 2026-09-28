'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useLogoutMutation } from '@/hooks/useAuth';

export function NavbarClient() {
  const router = useRouter();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const { mutateAsync: logoutApi, isPending: isLoggingOut } = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Локальний стан мутація чистить і при помилці (cookies могли бути вже недійсні)
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  // Сесія ще відновлюється (`GET /auth/me`) — не блимати кнопкою «Увійти»
  if (isAuthLoading) {
    return <div className="h-9 w-20 sm:w-40" aria-hidden />;
  }

  // Щоб навбар влазив: ім'я (до 50 символів — обрізане) — від 1024 px, посилання на адмінку —
  // від 640 px, «Реєстрація» на вузькому екрані — зі сторінки входу; бургер-меню — етап 7.1
  if (user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden lg:flex items-center gap-2 min-w-0 text-sm text-gray-400">
          <span className="truncate max-w-32" title={user.name}>
            {user.name}
          </span>
          {user.role === 'ADMIN' && (
            <span className="shrink-0 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
              {tAuth('adminBadge')}
            </span>
          )}
        </span>
        {user.role === 'ADMIN' && (
          <a
            href={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}
            className="hidden sm:inline text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            {tNav('adminPanel')}
          </a>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 sm:px-4 py-2 rounded-lg transition-colors"
        >
          {tNav('logout')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/auth/login"
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        {tNav('signIn')}
      </Link>
      <Link
        href="/auth/register"
        className="hidden sm:inline-block text-sm bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg transition-colors"
      >
        {tNav('register')}
      </Link>
    </div>
  );
}
