'use client';

import { useTranslations } from 'next-intl';
import { FootballMatchStrip } from './FootballMatchStrip';
import { useFootballStageLabels } from '@/hooks/useFootballStageLabels';
import type { FixturesRound, MatchStatusDto } from '@/lib/api/types';

type RoundKindKey = 'upcoming' | 'past';

type Props = {
  roundKindKey: RoundKindKey;
  round: FixturesRound;
  formatStatus: (status: MatchStatusDto) => string;
  formatMatchWhen: (iso: string) => string;
};

export function FootballRoundBlock({
  roundKindKey,
  round,
  formatStatus,
  formatMatchWhen,
}: Props) {
  const tFootball = useTranslations('football');
  const { stageRoundLabel } = useFootballStageLabels();
  const kind = tFootball(roundKindKey);
  // Ліга — «Майбутній · Тур 6», як і раніше; кубок — стадія: «Загальний етап · Тур 2», «Фінал»
  const label =
    round.stage !== 'REGULAR_SEASON'
      ? stageRoundLabel(round.stage, round.matchday)
      : round.matchday != null
        ? tFootball('roundLabel', { kind, n: String(round.matchday) })
        : tFootball('roundLabelNoDay', { kind });

  return (
    <div className="border border-neutral-800 bg-neutral-950/60">
      <div className="border-b border-neutral-800 bg-black/60 px-3 py-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </h4>
      </div>
      <div className="divide-y divide-neutral-800/50">
        {round.matches.map((matchRow) => (
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
