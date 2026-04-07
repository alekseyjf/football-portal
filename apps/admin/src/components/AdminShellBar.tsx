'use client';

import Link from 'next/link';
import { getPublicWebUrl } from '@/lib/publicWebUrl';
import { useAdminLogout } from '@/hooks/useAdminLogout';

export function AdminShellBar() {
  const publicWeb = getPublicWebUrl();
  const { mutate: logout, isPending } = useAdminLogout();

  return (
    <header className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-white font-medium hover:text-green-400 transition-colors"
          >
            Дашборд
          </Link>
          <Link
            href="/dashboard/posts"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Пости
          </Link>
          <Link
            href="/dashboard/posts/create"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Новий пост
          </Link>
          <a
            href={publicWeb}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-green-400 transition-colors"
          >
            Публічний сайт ↗
          </a>
        </nav>
        <button
          type="button"
          disabled={isPending}
          onClick={() => logout()}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Вихід…' : 'Вийти'}
        </button>
      </div>
    </header>
  );
}
