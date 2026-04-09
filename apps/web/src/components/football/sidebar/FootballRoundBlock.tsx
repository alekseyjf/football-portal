'use client';

import { useTranslations } from 'next-intl';
import { FootballMatchStrip } from './FootballMatchStrip';
import type { FootballMatchRow, MatchStatusDto } from '@/lib/api/types';

type RoundKindKey = 'upcoming' | 'past';

type Props = {
  roundKindKey: RoundKindKey;
  matchday: number | null;
  matches: FootballMatchRow[];
  formatStatus: (status: MatchStatusDto) => string;
  formatMatchWhen: (iso: string) => string;
};

export function FootballRoundBlock({
  roundKindKey,
  matchday,
  matches,
  formatStatus,
  formatMatchWhen,
}: Props) {
  const tFootball = useTranslations('football');
  const kind = tFootball(roundKindKey);
  const label =
    matchday != null
      ? tFootball('roundLabel', { kind, n: String(matchday) })
      : tFootball('roundLabelNoDay', { kind });

  return (
    <div className="border border-neutral-800 bg-neutral-950/60">
      <div className="border-b border-neutral-800 bg-black/60 px-3 py-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </h4>
      </div>
      <div className="divide-y divide-neutral-800/50">
        {matches.map((matchRow) => (
          <FootballMatchStrip
            key={matchRow.id}
            matchRow={matchRow}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
          />
        ))}
      </div>
    </div>
  );
}
