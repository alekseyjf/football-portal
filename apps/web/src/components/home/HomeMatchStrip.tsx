'use client';

import { useLocale, useTranslations } from 'next-intl';
import { BlockLoadError } from '@/components/layout/BlockLoadError';
import { useHomeMatchStrip } from '@/hooks/useHomeMatchStrip';
import type { MatchStripDay } from '@/lib/football/home-match-strip';
import { formatDateTime } from '@/lib/i18n/date-time';
import { dayKeyToUtcNoon } from '@/lib/i18n/zoned-date';
import { HOME_NEWS_HEADING_ID } from './HomeNews';
import { MATCH_CARD_SIZE_CLASS } from './HomeMatchCard';
import { HomeMatchStripScroller } from './HomeMatchStripScroller';

const HEADING_ID = 'home-matches';
/** Заглушок у скелетоні — ширина десктопа; зайве ховає `overflow-hidden` */
const SKELETON_CARDS = 10;

function MatchStripSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-2 overflow-hidden pb-2">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <div
          key={index}
          className={`${MATCH_CARD_SIZE_CLASS} shrink-0 animate-pulse rounded-lg bg-neutral-900`}
        />
      ))}
    </div>
  );
}

/**
 * Стрічка матчів головної (M1.6.3, D55): матчі сьогодні в поясі читача, сьогодні порожньо — «Найближчі матчі · {дата}»,
 * немає й таких (міжсезоння) — блоку немає. Перед стрічкою — «Пропустити матчі» (видно з фокусом): до 40 посилань
 * інакше стояли б між читачем з клавіатури й новинами. Збій — свій скелетон і «Спробувати ще», решта сторінки працює.
 */
export function HomeMatchStrip({ today }: { today: MatchStripDay }) {
  const t = useTranslations('home');
  const locale = useLocale();
  const strip = useHomeMatchStrip(today);
  if (strip.status === 'none') return null;

  // Підпис самого дня (не миттєвості): полудень UTC у поясі UTC — без зсуву поясом читача, як на `/matches`
  const title =
    strip.status === 'ready' && !strip.isToday
      ? t('upcomingMatches', {
          date: formatDateTime(
            dayKeyToUtcNoon(strip.day.dayKey),
            locale,
            'UTC',
            {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
            },
          ),
        })
      : t('matchesToday');

  return (
    <section aria-labelledby={HEADING_ID} className="mb-8 min-w-0">
      <div className="mb-3 flex items-center gap-3">
        <h2 id={HEADING_ID} className="text-xl font-bold">
          {title}
        </h2>
        <a
          href={`#${HOME_NEWS_HEADING_ID}`}
          className="sr-only rounded bg-gray-800 px-2 py-1 text-sm focus:not-sr-only focus-visible:outline-2 focus-visible:outline-green-500"
        >
          {t('skipMatches')}
        </a>
      </div>
      {strip.status === 'loading' ? (
        <>
          <p role="status" className="sr-only">
            {t('matchesLoading')}
          </p>
          <MatchStripSkeleton />
        </>
      ) : strip.status === 'error' ? (
        <BlockLoadError
          message={t('matchesLoadError')}
          retryLabel={t('retry')}
          onRetry={strip.retry}
          className="py-3"
        />
      ) : (
        <HomeMatchStripScroller
          matches={strip.matches}
          dayKey={strip.isToday ? null : strip.day.dayKey}
          labelledBy={HEADING_ID}
        />
      )}
    </section>
  );
}
