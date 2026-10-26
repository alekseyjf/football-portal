import { useTranslations } from 'next-intl';

/** Новина не завантажилась: повідомлення й «Спробувати ще» (frontend, Rule 13). */
export function NewsPostLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('news');

  return (
    <div role="alert" className="py-12 text-center">
      <p className="mb-3 text-red-400/90">{t('loadError')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition-colors hover:bg-gray-700"
      >
        {t('retry')}
      </button>
    </div>
  );
}
