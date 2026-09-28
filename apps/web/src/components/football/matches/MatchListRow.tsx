'use client';

import { Link } from '@/i18n/navigation';
import { FootballClubCrest } from '@/components/football/FootballClubCrest';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import {
  isMatchInPlay,
  useMatchStatusLabel,
} from '@/hooks/useMatchStatusLabel';
import type { FootballClub, FootballMatchListItem } from '@/lib/api/types';

function ClubLine({
  club,
  alignEnd = false,
}: {
  club: FootballClub;
  /** Господарі в один рядок: назва біля рахунку (праворуч), емблема — після неї */
  alignEnd?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-2 min-w-0 text-sm font-medium text-neutral-100',
        alignEnd ? 'flex-row-reverse' : '',
      ].join(' ')}
    >
      <FootballClubCrest club={club} />
      <span className={`truncate ${alignEnd ? 'text-right' : ''}`}>
        {club.shortName ?? club.name}
      </span>
    </div>
  );
}

/**
 * Рядок матчу в списку дня. До 640 px — команди одна під одною (як у сайдбарі), інакше
 * назви обрізались до «Sunder…»; від 640 px — господарі · рахунок · гості в один рядок.
 */
export function MatchListRow({ match }: { match: FootballMatchListItem }) {
  const formatDateTime = useDateTimeFormat();
  const formatStatus = useMatchStatusLabel();
  const live = isMatchInPlay(match.status);
  const hasScore = match.homeScore != null && match.awayScore != null;
  const statusText =
    match.status === 'SCHEDULED'
      ? null
      : match.status === 'LIVE' && match.minute != null
        ? `${match.minute}′`
        : formatStatus(match.status);
  const scoreClassName = `tabular-nums font-bold ${live ? 'text-red-400' : 'text-white'}`;

  const timeAndStatus = (
    <div className="text-xs tabular-nums leading-tight">
      <time dateTime={match.kickoffAt} className="text-neutral-400">
        {formatDateTime(match.kickoffAt, { hour: '2-digit', minute: '2-digit' })}
      </time>
      {statusText && (
        <div className={live ? 'text-red-400 font-semibold' : 'text-neutral-500'}>
          {statusText}
        </div>
      )}
    </div>
  );

  return (
    <Link
      href={`/matches/${match.id}`}
      className={[
        'block px-3 sm:px-4 py-3 transition-colors hover:bg-neutral-900/80',
        live ? 'bg-red-950/25' : '',
      ].join(' ')}
    >
      <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:hidden">
        <div className="row-span-2">{timeAndStatus}</div>
        <ClubLine club={match.homeClub} />
        <span className={scoreClassName}>{match.homeScore ?? '–'}</span>
        <ClubLine club={match.awayClub} />
        <span className={scoreClassName}>{match.awayScore ?? '–'}</span>
      </div>

      <div className="hidden sm:grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-3">
        {timeAndStatus}
        <ClubLine club={match.homeClub} alignEnd />
        <div className={`text-center ${scoreClassName}`}>
          {hasScore ? `${match.homeScore} : ${match.awayScore}` : '–'}
        </div>
        <ClubLine club={match.awayClub} />
      </div>
    </Link>
  );
}
