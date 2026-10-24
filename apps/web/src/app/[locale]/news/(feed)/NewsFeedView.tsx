'use client';

import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { NewsCardList } from '@/components/news/NewsCardList';
import { NewsCardsSkeleton } from '@/components/news/NewsCardsSkeleton';
import { NewsFeedFilterChips } from '@/components/news/NewsFeedFilterChips';
import { NewsFeedLeagueTabs } from '@/components/news/NewsFeedLeagueTabs';
import { NewsFeedLoadMore } from '@/components/news/NewsFeedLoadMore';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import { Link } from '@/i18n/navigation';
import {
  NO_NEWS_FEED_FILTERS,
  hasChipFilters,
  newsFeedHref,
  type NewsFeedFilters,
} from '@/lib/news/news-feed-filters';
import { NEWS_FEED_PAGE_SIZE } from '@/lib/news/news-feed-query';

type Props = {
  filters: NewsFeedFilters;
  /** Перша сторінка списку — з адреси `?page=N` (D38) */
  startPage: number;
};

export function NewsFeedView({ filters, startPage }: Props) {
  const t = useTranslations('newsFeed');
  const { feedQuery, posts, nextPage, loadMore, focusPostId } = useNewsFeed(
    filters,
    startPage,
  );
  const hasChips = hasChipFilters(filters);
  const hasFilters = filters.competition !== null || hasChips;
  // Сервер віддав сторінку без даних (API не відповів) — клієнт вантажить сам, і «Спробувати ще» після помилки — теж.
  // Уже показаний список невдалий фоновий refetch не замінює
  const hasLoadError = feedQuery.data === undefined && feedQuery.isError;
  const isLoadingFirstPage =
    feedQuery.isPending || (hasLoadError && feedQuery.isFetching);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
      <NewsFeedLeagueTabs filters={filters} />
      <NewsFeedFilterChips filters={filters} />

      {startPage > 1 && (
        <Link
          href={newsFeedHref(filters)}
          className="inline-block text-sm text-green-400 hover:text-green-300 hover:underline"
        >
          <LinkPendingLabel>{t('newest')}</LinkPendingLabel>
        </Link>
      )}

      {isLoadingFirstPage ? (
        <>
          <p role="status" className="sr-only">
            {t('loading')}
          </p>
          <NewsCardsSkeleton count={NEWS_FEED_PAGE_SIZE} />
        </>
      ) : hasLoadError ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-red-400/90">{t('loadError')}</p>
          <button
            type="button"
            onClick={() => feedQuery.refetch()}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition-colors hover:bg-gray-700"
          >
            {t('retry')}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-gray-400">
            {hasFilters ? t('emptyFiltered') : t('empty')}
          </p>
          {/* З чипами «Очистити все» вже є поруч із ними */}
          {hasFilters && !hasChips && (
            <Link
              href={newsFeedHref(NO_NEWS_FEED_FILTERS)}
              className="text-sm text-green-400 hover:text-green-300 hover:underline"
            >
              <LinkPendingLabel>{t('clearAll')}</LinkPendingLabel>
            </Link>
          )}
        </div>
      ) : (
        <>
          <NewsCardList
            posts={posts}
            headingLevel={2}
            isFirstCoverPriority
            focusPostId={focusPostId}
            isBusy={feedQuery.isFetchingNextPage}
          />
          {nextPage !== null && (
            <NewsFeedLoadMore
              href={newsFeedHref(filters, nextPage)}
              isLoading={feedQuery.isFetchingNextPage}
              hasError={feedQuery.isFetchNextPageError}
              onLoadMore={loadMore}
            />
          )}
        </>
      )}
    </div>
  );
}
