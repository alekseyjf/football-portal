'use client';

import { useTranslations } from 'next-intl';
import { FootballRoundBlock } from './FootballRoundBlock';
import type { FootballMatchRow, MatchStatusDto } from '@/lib/api/types';

export type FixtureRoundGroup = {
  matchday: number | null;
  matches: FootballMatchRow[];
};

type SectionHeadingKey = 'upcomingRounds' | 'pastRounds';
type EmptyMessageKey = 'noUpcoming' | 'noPast';
type RoundKindKey = 'upcoming' | 'past';

type Props = {
  sectionHeadingKey: SectionHeadingKey;
  emptyMessageKey: EmptyMessageKey;
  roundKindKey: RoundKindKey;
  rounds: FixtureRoundGroup[];
  formatStatus: (status: MatchStatusDto) => string;
  formatMatchWhen: (iso: string) => string;
  isLoading: boolean;
  isError: boolean;
  listClassName?: string;
  roundListKeyPrefix: string;
};

export function FootballSidebarRoundsSection({
  sectionHeadingKey,
  emptyMessageKey,
  roundKindKey,
  rounds,
  formatStatus,
  formatMatchWhen,
  isLoading,
  isError,
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
        {isLoading && (
          <p className="text-xs text-neutral-500 py-4 text-center border border-neutral-800">
            {tFootball('loadingFixtures')}
          </p>
        )}
        {isError && (
          <p className="text-xs text-red-400/90 px-2">
            {tFootball('fixturesError')}
          </p>
        )}
        {!isLoading &&
          rounds.map((round, index) => (
            <FootballRoundBlock
              key={`${roundListKeyPrefix}-${index}-${round.matches[0]?.id ?? ''}`}
              roundKindKey={roundKindKey}
              matchday={round.matchday}
              matches={round.matches}
              formatStatus={formatStatus}
              formatMatchWhen={formatMatchWhen}
            />
          ))}
        {!isLoading && rounds.length === 0 && (
          <p className="text-xs text-neutral-500 border border-neutral-800 px-3 py-4 text-center">
            {tFootball(emptyMessageKey)}
          </p>
        )}
      </div>
    </div>
  );
}
