'use client';

import { useTranslations } from 'next-intl';

type Props = {
  error: Error & { digest?: string };
  /** Next 16: заново отримати й відрендерити сторінку (не лише скинути стан помилки, як `reset`) */
  unstable_retry: () => void;
};

/**
 * Непередбачена помилка сторінки стрічки (frontend, Rule 13). Збій API сюди не доходить: сторінка рендериться без
 * даних, а стрічка показує свою помилку й «Спробувати ще».
 */
export default function NewsFeedError({ unstable_retry }: Props) {
  const t = useTranslations('newsFeed');

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-white">{t('title')}</h1>
      <div role="alert" className="py-12 text-center">
        <p className="mb-3 text-red-400/90">{t('loadError')}</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition-colors hover:bg-gray-700"
        >
          {t('retry')}
        </button>
      </div>
    </main>
  );
}
