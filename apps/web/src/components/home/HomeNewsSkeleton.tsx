import {
  NEWS_CARD_LAYOUT_CLASSES,
  type NewsCardLayout,
} from '@/components/news/NewsCard';
import { HOME_LATEST_NEWS_COUNT } from '@/hooks/useHomeNews';
import {
  HOME_LEAD_ITEM_CLASS,
  HOME_NEWS_GRID_CLASS,
  homeNewsCardLayout,
} from './home-news-layout';

const PLACEHOLDER_CLASS = 'animate-pulse rounded bg-gray-800';

/** Заглушка картки: ті самі класи вигляду, що в `NewsCard`, — розміри збігаються, сторінка не стрибає. */
function NewsCardPlaceholder({ layout }: { layout: NewsCardLayout }) {
  const classes = NEWS_CARD_LAYOUT_CLASSES[layout];
  return (
    <div
      className={`flex h-full overflow-hidden rounded-xl bg-gray-900 ${classes.article}`}
    >
      <div className={`aspect-video animate-pulse bg-gray-800 ${classes.cover}`} />
      <div className={`flex flex-1 flex-col gap-2 ${classes.body}`}>
        <div className={`h-3 w-20 ${PLACEHOLDER_CLASS}`} />
        <div className={`h-4 w-full ${PLACEHOLDER_CLASS}`} />
        <div className={`h-4 w-2/3 ${PLACEHOLDER_CLASS}`} />
        <div className={`mt-auto h-3 w-16 ${PLACEHOLDER_CLASS}`} />
      </div>
    </div>
  );
}

/** Новини головної вантажаться (сервер не дочекався API або «Спробувати ще»): головна новина й шість під нею. */
export function HomeNewsSkeleton() {
  return (
    <ul className={HOME_NEWS_GRID_CLASS} aria-hidden="true">
      <li className={HOME_LEAD_ITEM_CLASS}>
        <NewsCardPlaceholder layout="lead" />
      </li>
      {Array.from({ length: HOME_LATEST_NEWS_COUNT }, (_, index) => (
        <li key={index}>
          <NewsCardPlaceholder layout={homeNewsCardLayout(index)} />
        </li>
      ))}
    </ul>
  );
}
