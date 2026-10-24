'use client';

import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { Link } from '@/i18n/navigation';
import { useNewsFeedFilterChips } from '@/hooks/useNewsFeedFilters';
import {
  NO_NEWS_FEED_FILTERS,
  newsFeedHref,
  type NewsFeedFilters,
} from '@/lib/news/news-feed-filters';

/**
 * Вибрані теги й клуби — чипи з «×» (M1.6.1): вибирають їх посилання новини, а тут — лише прибирають. «Очистити все» —
 * стрічка без жодного фільтра, і без ліги.
 */
export function NewsFeedFilterChips({ filters }: { filters: NewsFeedFilters }) {
  const t = useTranslations('newsFeed');
  const chips = useNewsFeedFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ul aria-label={t('activeFiltersLabel')} className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              // Видимий підпис — частина назви посилання (WCAG 2.5.3), «×» — лише для очей
              aria-label={t('removeFilter', { filter: chip.label })}
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 py-1 pl-3 pr-2.5 text-sm text-gray-200 transition-colors hover:border-gray-500 hover:text-white"
            >
              <LinkPendingLabel>{chip.label}</LinkPendingLabel>
              <span aria-hidden="true" className="text-base leading-none text-gray-400">
                ×
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={newsFeedHref(NO_NEWS_FEED_FILTERS)}
        className="text-sm text-green-400 hover:text-green-300 hover:underline"
      >
        <LinkPendingLabel>{t('clearAll')}</LinkPendingLabel>
      </Link>
    </div>
  );
}
