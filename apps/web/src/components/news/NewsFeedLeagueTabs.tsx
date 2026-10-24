'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { Link } from '@/i18n/navigation';
import { useNewsFeedLeagueTabs } from '@/hooks/useNewsFeedFilters';
import {
  newsFeedHref,
  type NewsFeedFilters,
} from '@/lib/news/news-feed-filters';

function tabClassName(isSelected: boolean): string {
  return [
    'inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isSelected
      ? 'border-green-500 text-white'
      : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-white',
  ].join(' ');
}

/**
 * Вкладки ліг стрічки — один вибір: «Усі | Premier League | …» (M1.6.1). Це посилання (`?competition=`), а не
 * вкладки ARIA: кожна — окрема адреса; теги й клуби лишаються, сторінка — перша. До 1024 px — один рядок з
 * горизонтальною прокруткою, і вибрана вкладка прокручується в поле зору.
 */
export function NewsFeedLeagueTabs({ filters }: { filters: NewsFeedFilters }) {
  const t = useTranslations('newsFeed');
  const leagues = useNewsFeedLeagueTabs(filters.competition);
  const selectedTabRef = useRef<HTMLAnchorElement>(null);
  const tabs = [
    { slug: null, name: t('allLeagues') },
    ...leagues.map(({ slug, name }) => ({ slug, name })),
  ];

  // Лише вздовж рядка вкладок: `scrollIntoView` прокрутив би й сторінку (назад до вкладок після «Назад» браузера)
  useEffect(() => {
    const selectedTab = selectedTabRef.current;
    const tabList = selectedTab?.closest('ul');
    if (!selectedTab || !tabList) return;
    tabList.scrollLeft =
      selectedTab.offsetLeft - (tabList.clientWidth - selectedTab.offsetWidth) / 2;
  }, [filters.competition, tabs.length]);

  return (
    <nav aria-label={t('leaguesLabel')} className="border-b border-gray-800">
      <ul className="relative flex overflow-x-auto lg:flex-wrap lg:overflow-visible">
        {tabs.map((tab) => {
          const isSelected = tab.slug === filters.competition;
          return (
            <li key={tab.slug ?? ''} className="shrink-0">
              <Link
                ref={isSelected ? selectedTabRef : undefined}
                href={newsFeedHref({ ...filters, competition: tab.slug })}
                aria-current={isSelected ? 'page' : undefined}
                className={tabClassName(isSelected)}
              >
                <LinkPendingLabel>{tab.name}</LinkPendingLabel>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
