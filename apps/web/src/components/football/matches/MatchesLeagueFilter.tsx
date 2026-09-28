'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FootballLeagueEmblem } from '@/components/football/sidebar/FootballLeagueEmblem';
import type { FootballLeagueMeta } from '@/lib/api/types';
import { matchesPageHref } from '@/lib/football/matches-page';

type Props = {
  /** Активні турніри за `sortOrder` (`GET /football/leagues`) */
  leagues: FootballLeagueMeta[];
  selectedLeagueSlug: string | null;
  /** `null` — сьогодні (посилання без `?date=`) */
  dayKey: string | null;
};

function chipClassName(isSelected: boolean): string {
  return [
    'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    isSelected
      ? 'border-green-500 bg-green-600/20 text-white'
      : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-600 hover:text-white',
  ].join(' ');
}

/**
 * Фільтр списку за турніром: справжні посилання (`?league=`), день зберігається. До 640 px —
 * один рядок із горизонтальною прокруткою (інакше 10 чипів займають пів екрана), далі — з переносом.
 */
export function MatchesLeagueFilter({
  leagues,
  selectedLeagueSlug,
  dayKey,
}: Props) {
  const t = useTranslations('matches');

  return (
    <nav aria-label={t('leagueFilterLabel')}>
      <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        <li className="shrink-0">
          <Link
            href={matchesPageHref(dayKey, null)}
            aria-current={selectedLeagueSlug === null ? 'true' : undefined}
            className={chipClassName(selectedLeagueSlug === null)}
          >
            {t('allLeagues')}
          </Link>
        </li>
        {leagues.map((league) => (
          <li key={league.slug} className="shrink-0">
            <Link
              href={matchesPageHref(dayKey, league.slug)}
              aria-current={
                league.slug === selectedLeagueSlug ? 'true' : undefined
              }
              className={chipClassName(league.slug === selectedLeagueSlug)}
            >
              <FootballLeagueEmblem
                emblemUrl={league.emblemUrl}
                fallbackText={league.slug}
              />
              {league.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
