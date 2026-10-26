'use client';

import { useTranslations } from 'next-intl';
import { BlockLoadError } from '@/components/layout/BlockLoadError';

type Props = {
  error: Error & { digest?: string };
  /** Next 16: заново отримати й відрендерити сторінку (не лише скинути стан помилки, як `reset`) */
  unstable_retry: () => void;
};

/**
 * Головна, коли API недоступне для всіх її запитів (D55), — одне повідомлення замість трьох однакових; і непередбачена
 * помилка сторінки (frontend, Rule 13). Збій окремого блоку сюди не доходить: у блоці — своє «Спробувати ще».
 */
export default function HomeError({ unstable_retry }: Props) {
  const t = useTranslations('home');

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="sr-only">{t('title')}</h1>
      <BlockLoadError
        message={t('loadError')}
        retryLabel={t('retry')}
        onRetry={() => unstable_retry()}
        className="py-16"
      />
    </main>
  );
}
