'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type Props = {
  /** Адреса наступної сторінки (`?page=N+1`) — за нею йдуть пошукові системи й Cmd/Ctrl-клік (D38) */
  href: string;
  isLoading: boolean;
  hasError: boolean;
  onLoadMore: () => void;
};

/**
 * «Завантажити ще» — посилання на наступну сторінку, яке клієнт перехоплює й дописує список (D38): Google не
 * натискає кнопок, але йде за посиланнями. `onNavigate` спрацьовує лише на звичайний клік — Cmd/Ctrl-клік і середня
 * кнопка відкривають сторінку в новій вкладці, як будь-яке посилання.
 */
export function NewsFeedLoadMore({
  href,
  isLoading,
  hasError,
  onLoadMore,
}: Props) {
  const t = useTranslations('newsFeed');

  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      {hasError && (
        <p role="alert" className="text-sm text-red-400">
          {t('loadMoreError')}
        </p>
      )}
      <Link
        href={href}
        prefetch={false}
        onNavigate={(event) => {
          event.preventDefault();
          if (!isLoading) onLoadMore();
        }}
        aria-disabled={isLoading || undefined}
        className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-900 hover:text-white aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        {isLoading ? t('loadingMore') : t('loadMore')}
      </Link>
    </div>
  );
}
