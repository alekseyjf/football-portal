'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BlockLoadError } from '@/components/layout/BlockLoadError';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { NewsCard } from '@/components/news/NewsCard';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { homeNewsQueryOptions } from '@/hooks/useHomeNews';
import { Link } from '@/i18n/navigation';
import { HomeNewsSkeleton } from './HomeNewsSkeleton';
import {
  HOME_LEAD_ITEM_CLASS,
  HOME_NEWS_GRID_CLASS,
  homeNewsCardLayout,
} from './home-news-layout';

/** Сюди веде «Пропустити матчі» над стрічкою матчів */
export const HOME_NEWS_HEADING_ID = 'home-news';

/**
 * «Останні новини» головної (M1.6.3, D55): головна новина з великим фото (LCP) і шість останніх, далі «Усі новини».
 * Дані — з кешу, який наповнив сервер; без них (сервер не дочекався API) клієнт вантажить сам — скелетон, помилка —
 * «Спробувати ще» лише в цьому блоці.
 */
export function HomeNews() {
  const t = useTranslations('home');
  const lang = useApiContentLang();
  const newsQuery = useQuery(homeNewsQueryOptions(lang));
  // Показані новини невдалий фоновий refetch не замінює — помилка лише тоді, коли показувати нічого
  const hasLoadError = newsQuery.data === undefined && newsQuery.isError;
  const isLoading =
    newsQuery.isPending || (hasLoadError && newsQuery.isFetching);
  const lead = newsQuery.data?.lead ?? null;
  const latest = newsQuery.data?.latest ?? [];

  return (
    <section aria-labelledby={HOME_NEWS_HEADING_ID} className="min-w-0 space-y-5">
      {/* `tabIndex={-1}` — фокус після «Пропустити матчі»: далі Tab — перша новина */}
      <h2
        id={HOME_NEWS_HEADING_ID}
        tabIndex={-1}
        className="text-2xl font-bold outline-none"
      >
        {t('latestNews')}
      </h2>
      {isLoading ? (
        <>
          <p role="status" className="sr-only">
            {t('newsLoading')}
          </p>
          <HomeNewsSkeleton />
        </>
      ) : hasLoadError ? (
        <BlockLoadError
          message={t('newsLoadError')}
          retryLabel={t('retry')}
          onRetry={() => newsQuery.refetch()}
        />
      ) : !lead ? (
        <p className="py-12 text-center text-gray-400">{t('newsEmpty')}</p>
      ) : (
        <>
          <ul className={HOME_NEWS_GRID_CLASS}>
            <li className={HOME_LEAD_ITEM_CLASS}>
              <NewsCard
                post={lead}
                headingLevel={3}
                layout="lead"
                isCoverPriority
              />
            </li>
            {latest.map((post, index) => (
              <li key={post.id}>
                <NewsCard
                  post={post}
                  headingLevel={3}
                  layout={homeNewsCardLayout(index)}
                />
              </li>
            ))}
          </ul>
          <Link
            href="/news"
            className="inline-block text-sm font-semibold text-green-400 hover:text-green-300 hover:underline"
          >
            <LinkPendingLabel>{t('allNews')}</LinkPendingLabel>
          </Link>
        </>
      )}
    </section>
  );
}
