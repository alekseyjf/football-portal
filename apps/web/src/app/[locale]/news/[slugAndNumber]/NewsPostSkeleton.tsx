import { useTranslations } from 'next-intl';

const PLACEHOLDER_CLASS = 'animate-pulse rounded bg-gray-800';

/**
 * Заглушка новини, поки її вантажить клієнт (сервер не дочекався API) і після «Спробувати ще»: ритм — як у справжньої
 * сторінки (крихти, рубрика, заголовок, анонс, фото, абзаци), щоб вона не стрибала.
 */
export function NewsPostSkeleton() {
  const t = useTranslations('news');

  return (
    <>
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div aria-hidden="true">
        <div className={`mb-6 h-4 w-48 ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-3 h-3 w-24 ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-3 h-9 w-full ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-5 h-9 w-2/3 ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-2 h-5 w-full ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-5 h-5 w-5/6 ${PLACEHOLDER_CLASS}`} />
        <div className={`mb-8 h-4 w-56 ${PLACEHOLDER_CLASS}`} />
        <div className="mb-8 aspect-video w-full animate-pulse rounded-2xl bg-gray-800" />
        <div className="space-y-3">
          <div className={`h-4 w-full ${PLACEHOLDER_CLASS}`} />
          <div className={`h-4 w-full ${PLACEHOLDER_CLASS}`} />
          <div className={`h-4 w-3/4 ${PLACEHOLDER_CLASS}`} />
        </div>
      </div>
    </>
  );
}
