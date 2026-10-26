'use client';

import { NewsPostLoadError } from './NewsPostLoadError';

type Props = {
  error: Error & { digest?: string };
  /** Next 16: заново отримати й відрендерити сторінку (не лише скинути стан помилки, як `reset`) */
  unstable_retry: () => void;
};

/**
 * Непередбачена помилка сторінки новини (frontend, Rule 13). Збій API сюди не доходить: сторінка рендериться без
 * даних, а новина показує свою помилку й «Спробувати ще»; 404 — загальна `app/not-found.tsx`.
 */
export default function NewsPostError({ unstable_retry }: Props) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <NewsPostLoadError onRetry={() => unstable_retry()} />
    </main>
  );
}
