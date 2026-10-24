import { NEWS_CARD_GRID_CLASS } from './NewsCardList';

const PLACEHOLDER_CLASS = 'animate-pulse rounded bg-gray-800';

/** Сітка-заглушка поки стрічка вантажиться: розмір і ритм — як у справжніх карток, щоб сторінка не стрибала. */
export function NewsCardsSkeleton({ count }: { count: number }) {
  return (
    <ul className={NEWS_CARD_GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-xl bg-gray-900">
          <div className="aspect-video w-full animate-pulse bg-gray-800" />
          <div className="space-y-3 p-5">
            <div className={`h-3 w-24 ${PLACEHOLDER_CLASS}`} />
            <div className={`h-5 w-full ${PLACEHOLDER_CLASS}`} />
            <div className={`h-5 w-2/3 ${PLACEHOLDER_CLASS}`} />
            <div className={`h-3 w-full ${PLACEHOLDER_CLASS}`} />
            <div className={`h-3 w-20 ${PLACEHOLDER_CLASS}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
