'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MatchesDayNav } from '@/components/football/matches/MatchesDayNav';
import { MatchesLeagueFilter } from '@/components/football/matches/MatchesLeagueFilter';
import { MatchesLeagueGroup } from '@/components/football/matches/MatchesLeagueGroup';
import {
  leaguesQueryOptions,
  matchesInRangeQueryOptions,
} from '@/hooks/useFootball';
import { matchesRefetchInterval } from '@/lib/football/match-polling';
import { groupMatchesByLeague } from '@/lib/football/matches-page';

type Props = {
  /** День `YYYY-MM-DD` у поясі користувача */
  dayKey: string;
  todayKey: string;
  /** Межі дня — миттєвості ISO (`zonedDayRange`), ті самі, що в prefetch сервера */
  from: string;
  to: string;
  leagueSlug: string | null;
};

export function MatchesDayView({
  dayKey,
  todayKey,
  from,
  to,
  leagueSlug,
}: Props) {
  const t = useTranslations('matches');
  const leagues = useQuery(leaguesQueryOptions());
  const matchesQuery = useQuery({
    ...matchesInRangeQueryOptions(from, to, leagueSlug),
    // Те саме правило, що в стрічці головної (D55): у грі — 60 с, інакше — у момент найближчого початку
    refetchInterval: (query) =>
      matchesRefetchInterval(query.state.data?.matches ?? [], new Date()),
  });
  const groups = groupMatchesByLeague(
    matchesQuery.data?.matches ?? [],
    leagues.data ?? [],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
      <MatchesDayNav
        dayKey={dayKey}
        todayKey={todayKey}
        leagueSlug={leagueSlug}
      />
      <MatchesLeagueFilter
        leagues={leagues.data ?? []}
        selectedLeagueSlug={leagueSlug}
        dayKey={dayKey === todayKey ? null : dayKey}
      />

      {matchesQuery.isPending ? (
        <p className="py-12 text-center text-neutral-400">{t('loading')}</p>
      ) : matchesQuery.isError ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-red-400/90">{t('loadError')}</p>
          <button
            type="button"
            onClick={() => matchesQuery.refetch()}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm transition-colors hover:bg-neutral-700"
          >
            {t('retry')}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-neutral-400">{t('empty')}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <MatchesLeagueGroup key={group.league.slug} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
