import type { PostSummary } from '@/lib/api/types';
import { NewsCard } from './NewsCard';

/** Сітка карток: телефон — одна колонка, від 640 px — дві, від 1024 px — три. Та сама — у скелетоні. */
export const NEWS_CARD_GRID_CLASS = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3';

type Props = {
  posts: PostSummary[];
  headingLevel: 2 | 3;
  /** Обкладинка першої картки — пріоритетна (LCP), лише коли список — перше, що бачить читач */
  isFirstCoverPriority?: boolean;
  /** Новина, на заголовок якої перейде фокус (перша нова після «Завантажити ще») */
  focusPostId?: string | null;
  isBusy?: boolean;
};

export function NewsCardList({
  posts,
  headingLevel,
  isFirstCoverPriority = false,
  focusPostId = null,
  isBusy = false,
}: Props) {
  return (
    <ul className={NEWS_CARD_GRID_CLASS} aria-busy={isBusy || undefined}>
      {posts.map((post, index) => (
        <li key={post.id}>
          <NewsCard
            post={post}
            headingLevel={headingLevel}
            isCoverPriority={isFirstCoverPriority && index === 0}
            isFocusTarget={post.id === focusPostId}
          />
        </li>
      ))}
    </ul>
  );
}
