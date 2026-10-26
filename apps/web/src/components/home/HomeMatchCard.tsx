'use client';

import { useTranslations } from 'next-intl';
import { FootballClubCrest } from '@/components/football/FootballClubCrest';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import {
  isMatchInPlay,
  useMatchStatusLabel,
} from '@/hooks/useMatchStatusLabel';
import { Link } from '@/i18n/navigation';
import type { Club, MatchListItem, MatchStatus } from '@/lib/api/types';

/** Матч не за розкладом — статус у картці помітний (D55): перенесений, перерваний, скасований. */
const OFF_SCHEDULE_STATUSES: readonly MatchStatus[] = [
  'POSTPONED',
  'SUSPENDED',
  'CANCELLED',
];

/** Розмір картки — і для скелетона стрічки: висота стала, сторінка не стрибає. */
export const MATCH_CARD_SIZE_CLASS = 'h-[5.25rem] w-28';

function TeamLine({
  club,
  score,
  isLive,
}: {
  club: Club;
  score: number | null;
  isLive: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <FootballClubCrest club={club} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-100">
        {club.tla ?? club.shortName ?? club.name}
      </span>
      {score !== null && (
        <span
          className={`tabular-nums text-sm font-bold ${isLive ? 'text-red-400' : 'text-white'}`}
        >
          {score}
        </span>
      )}
    </span>
  );
}

/** Колір статусу: гра йде — червоний, не за розкладом — бурштиновий, час початку — світлий, решта — приглушена. */
function statusClassName(status: MatchStatus): string {
  if (isMatchInPlay(status)) return 'text-red-400';
  if (OFF_SCHEDULE_STATUSES.includes(status)) return 'text-amber-400';
  return status === 'SCHEDULED' ? 'text-neutral-300' : 'text-neutral-500';
}

/**
 * Матч у стрічці головної (D55): код турніру, статус або час початку, команди — трилітерний код з емблемою — і рахунок.
 * Уся картка — посилання на сторінку матчу; диктор читає одне речення з повними назвами (видиме — `aria-hidden`).
 */
export function HomeMatchCard({ match }: { match: MatchListItem }) {
  const t = useTranslations('home');
  const formatDateTime = useDateTimeFormat();
  const formatStatus = useMatchStatusLabel();
  const isLive = isMatchInPlay(match.status);
  const liveMinute = match.status === 'LIVE' ? match.minute : null;
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const kickoffTime = formatDateTime(match.kickoffAt, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const statusText =
    liveMinute !== null ? `${liveMinute}′` : formatStatus(match.status);
  const readerStatus =
    match.status === 'SCHEDULED'
      ? kickoffTime
      : liveMinute !== null
        ? t('matchMinute', { minute: String(liveMinute) })
        : formatStatus(match.status);
  const readerTeams = {
    league: match.league.name,
    home: match.homeClub.name,
    away: match.awayClub.name,
    status: readerStatus,
  };
  const readerLabel =
    match.homeScore !== null && match.awayScore !== null
      ? t('matchScored', {
          ...readerTeams,
          homeScore: String(match.homeScore),
          awayScore: String(match.awayScore),
        })
      : t('matchUnscored', readerTeams);

  return (
    <Link
      href={`/matches/${match.id}`}
      className={[
        MATCH_CARD_SIZE_CLASS,
        'flex flex-col justify-between rounded-lg border px-2.5 py-2 transition-colors hover:bg-neutral-900',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-500',
        isLive
          ? 'border-red-900/70 bg-red-950/25'
          : 'border-neutral-800 bg-neutral-950',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wide"
      >
        <span className="truncate text-neutral-500">{match.league.slug}</span>
        <span
          className={`flex min-w-0 items-center gap-1 ${statusClassName(match.status)}`}
        >
          {isLive && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse" />
          )}
          {match.status === 'SCHEDULED' ? (
            <time dateTime={match.kickoffAt}>{kickoffTime}</time>
          ) : (
            <span className="truncate" title={formatStatus(match.status)}>
              {statusText}
            </span>
          )}
        </span>
      </span>
      <span aria-hidden="true" className="space-y-1">
        <TeamLine
          club={match.homeClub}
          score={hasScore ? match.homeScore : null}
          isLive={isLive}
        />
        <TeamLine
          club={match.awayClub}
          score={hasScore ? match.awayScore : null}
          isLive={isLive}
        />
      </span>
      <span className="sr-only">{readerLabel}</span>
    </Link>
  );
}
