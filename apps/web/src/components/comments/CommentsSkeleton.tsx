import { useTranslations } from 'next-intl';

type Props = { count: number };

/**
 * Скелетон порції — картки тієї ж висоти, що й коментар в один-два рядки: коментарі приходять, коли до них докрутили
 * (D27), і нічого навколо не стрибає.
 */
export function CommentsSkeleton({ count }: Props) {
  const t = useTranslations('comments');
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: count }, (_item, index) => (
        <div
          key={index}
          aria-hidden
          className="animate-pulse rounded-xl bg-gray-900 px-4 py-3 sm:px-5 sm:py-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gray-800" />
            <div className="h-4 w-32 rounded bg-gray-800" />
          </div>
          <div className="mb-1.5 h-3.5 w-full rounded bg-gray-800" />
          <div className="h-3.5 w-2/3 rounded bg-gray-800" />
          <div className="mt-3 h-7 w-24 rounded-full bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
