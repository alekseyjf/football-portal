'use client';

import { Link } from '@/i18n/navigation';
import { useFootballStageLabels } from '@/hooks/useFootballStageLabels';
import { isMatchInPlay } from '@/hooks/useMatchStatusLabel';
import type { FootballMatchRow, MatchStatusDto } from '@/lib/api/types';

type Props = {
  matchRow: FootballMatchRow;
  formatStatus: (status: MatchStatusDto) => string;
  formatMatchWhen: (iso: string) => string;
};

export function FootballMatchStrip({
  matchRow,
  formatStatus,
  formatMatchWhen,
}: Props) {
  const { groupLabel } = useFootballStageLabels();
  const live = isMatchInPlay(matchRow.status);
  const score =
    matchRow.homeScore != null && matchRow.awayScore != null
      ? `${matchRow.homeScore} : ${matchRow.awayScore}`
      : '— : —';

  return (
    <Link
      href={`/matches/${matchRow.id}`}
      className={[
        'block px-3 py-2.5 border-b border-neutral-800/90 transition-colors',
        'hover:bg-neutral-900/80',
        live ? 'bg-red-950/25 border-l-2 border-l-red-600' : 'border-l-2 border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
        <span>
          {formatMatchWhen(matchRow.kickoffAt)}
          {/* Груповий етап кубка: у турі — матчі всіх груп (ЧС — 12) */}
          {matchRow.groupName && ` · ${groupLabel(matchRow.groupName)}`}
        </span>
        <span
          className={
            live ? 'text-red-400 font-semibold' : 'text-neutral-500'
          }
        >
          {matchRow.status === 'LIVE' && matchRow.minute != null
            ? `${matchRow.minute}′`
            : formatStatus(matchRow.status)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate font-medium text-neutral-100">
            {matchRow.homeClub.shortName ?? matchRow.homeClub.name}
          </div>
          <div className="truncate font-medium text-neutral-300">
            {matchRow.awayClub.shortName ?? matchRow.awayClub.name}
          </div>
        </div>
        <div className="shrink-0 tabular-nums text-base font-bold text-white">
          {score}
        </div>
      </div>
    </Link>
  );
}
