import { useTranslations } from 'next-intl';

type Props = {
  label: string;
  isLoading: boolean;
  hasError: boolean;
  onLoadMore: () => void;
};

/** «Показати ще» — наступна порція за курсором (D27); не вдалося — пояснення й та сама кнопка. */
export function CommentsLoadMore({ label, isLoading, hasError, onLoadMore }: Props) {
  const t = useTranslations('comments');
  return (
    <div className="mt-3">
      {hasError && (
        <p role="alert" className="mb-2 text-xs text-red-400/90">
          {t('loadError')}
        </p>
      )}
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
        aria-busy={isLoading}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-sky-400 transition-colors hover:bg-gray-800 hover:text-sky-300 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading ? t('loadingMore') : label}
      </button>
    </div>
  );
}
