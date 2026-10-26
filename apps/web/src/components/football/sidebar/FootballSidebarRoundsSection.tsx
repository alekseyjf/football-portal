'use client';

import { useTranslations } from 'next-intl';
import { FootballRoundBlock } from './FootballRoundBlock';
import type { FixturesRound, MatchStatus } from '@/lib/api/types';

type SectionHeadingKey = 'upcomingRounds' | 'pastRounds';
type EmptyMessageKey = 'noUpcoming' | 'noPast';
type RoundKindKey = 'upcoming' | 'past';

type Props = {
  sectionHeadingKey: SectionHeadingKey;
  emptyMessageKey: EmptyMessageKey;
  roundKindKey: RoundKindKey;
  rounds: FixturesRound[];
  formatStatus: (status: MatchStatus) => string;
  formatMatchWhen: (iso: string) => string;
  listClassName?: string;
  roundListKeyPrefix: string;
};

/** Тури обраної ліги — дані вже є: завантаження й помилку показує `FootballSidebar` (D55). */
export function FootballSidebarRoundsSection({
  sectionHeadingKey,
  emptyMessageKey,
  roundKindKey,
  rounds,
  formatStatus,
  formatMatchWhen,
  listClassName = 'space-y-3',
  roundListKeyPrefix,
}: Props) {
  const tFootball = useTranslations('football');

  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2 px-1">
        {tFootball(sectionHeadingKey)}
      </h3>
      <div className={listClassName}>
        {rounds.map((round) => (
          <FootballRoundBlock
            key={`${roundListKeyPrefix}-${round.stage}-${round.matchday ?? 'stage'}`}
            roundKindKey={roundKindKey}
            round={round}
            formatStatus={formatStatus}
            formatMatchWhen={formatMatchWhen}
          />
        ))}
        {rounds.length === 0 && (
          <p className="text-xs text-neutral-500 border border-neutral-800 px-3 py-4 text-center">
            {tFootball(emptyMessageKey)}
          </p>
        )}
      </div>
    </div>
  );
}
