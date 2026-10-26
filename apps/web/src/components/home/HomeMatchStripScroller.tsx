'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { LinkPendingLabel } from '@/components/layout/LinkPendingLabel';
import { useHorizontalScroller } from '@/hooks/useHorizontalScroller';
import { Link } from '@/i18n/navigation';
import type { MatchListItem } from '@/lib/api/types';
import { matchesPageHref } from '@/lib/football/matches-page';
import { HomeMatchCard, MATCH_CARD_SIZE_CLASS } from './HomeMatchCard';

type Props = {
  matches: MatchListItem[];
  /** День стрічки `YYYY-MM-DD`; `null` — сьогодні (`/matches` без `?date=`) */
  dayKey: string | null;
  /** Заголовок блоку — назва області прокрутки для диктора */
  labelledBy: string;
};

const SCROLL_BUTTON_CLASS =
  'hidden h-12 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-xl text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white disabled:cursor-default disabled:opacity-30 lg:flex';

/**
 * Матчі дня в один рядок з прокруткою вбік (D55): scroll-snap, край обрізаної картки видно; від 1024 px — кнопки ‹ ›.
 * Область — `role="region"` з назвою блоку й `tabIndex={0}`: її гортають і стрілками клавіатури. Остання картка —
 * «Усі матчі →» на сторінку матчів того самого дня.
 */
export function HomeMatchStripScroller({ matches, dayKey, labelledBy }: Props) {
  const t = useTranslations('home');
  const scrollerId = useId();
  const { scrollerRef, canScrollBack, canScrollForward, scrollByPage } =
    useHorizontalScroller<HTMLDivElement>();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t('scrollMatchesBack')}
        aria-controls={scrollerId}
        disabled={!canScrollBack}
        onClick={() => scrollByPage(-1)}
        className={SCROLL_BUTTON_CLASS}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div
        id={scrollerId}
        ref={scrollerRef}
        role="region"
        aria-labelledby={labelledBy}
        tabIndex={0}
        // `relative`: приховані підписи карток (`sr-only` — absolute) інакше позиціонуються поза областю й розширюють сторінку
        className="relative min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-lg pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
      >
        <ul className="flex gap-2">
          {matches.map((match) => (
            <li key={match.id} className="shrink-0 snap-start">
              <HomeMatchCard match={match} />
            </li>
          ))}
          <li className="shrink-0 snap-start">
            <Link
              href={matchesPageHref(dayKey, null)}
              className={`${MATCH_CARD_SIZE_CLASS} flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 px-2 text-center text-sm font-semibold text-green-400 transition-colors hover:border-neutral-600 hover:text-green-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-500`}
            >
              <LinkPendingLabel>{t('allMatches')}</LinkPendingLabel>
            </Link>
          </li>
        </ul>
      </div>
      <button
        type="button"
        aria-label={t('scrollMatchesForward')}
        aria-controls={scrollerId}
        disabled={!canScrollForward}
        onClick={() => scrollByPage(1)}
        className={SCROLL_BUTTON_CLASS}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
