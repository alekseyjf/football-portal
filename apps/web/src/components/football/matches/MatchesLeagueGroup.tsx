'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FootballLeagueEmblem } from '@/components/football/sidebar/FootballLeagueEmblem';
import { useFootballStageLabels } from '@/hooks/useFootballStageLabels';
import { LEAGUE_QUERY_PARAM } from '@/lib/football/league-param';
import {
  commonRoundOf,
  type LeagueMatchGroup,
} from '@/lib/football/matches-page';
import { MatchListRow } from './MatchListRow';

/**
 * Турнір у списку матчів дня: емблема, назва (→ таблиця й тури в сайдбарі головної, поки немає
 * сторінки ліги, етап 7.1), спільний тур, матчі.
 */
export function MatchesLeagueGroup({ group }: { group: LeagueMatchGroup }) {
  const t = useTranslations('matches');
  const { roundLabel } = useFootballStageLabels();
  const commonRound = commonRoundOf(group.matches);
  const roundText = commonRound
    ? roundLabel(commonRound.stage, commonRound.matchday)
    : null;

  return (
    <section className="border border-neutral-800 bg-neutral-950/60">
      <header className="flex items-center gap-3 border-b border-neutral-800 bg-black/60 px-3 sm:px-4 py-2.5">
        <FootballLeagueEmblem
          emblemUrl={group.league.emblemUrl}
          fallbackText={group.league.slug}
        />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-white">
            <Link
              href={{
                pathname: '/',
                query: { [LEAGUE_QUERY_PARAM]: group.league.slug },
              }}
              title={t('leagueLink', { league: group.league.name })}
              className="hover:text-green-400 transition-colors"
            >
              {group.league.name}
            </Link>
          </h2>
          {roundText && (
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">
              {roundText}
            </p>
          )}
        </div>
      </header>
      <div className="divide-y divide-neutral-800/60">
        {group.matches.map((match) => (
          <MatchListRow key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}
