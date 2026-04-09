'use client';

import { useTranslations } from 'next-intl';
import { FootballStandingsTable } from './FootballStandingsTable';
import type { StandingRow } from '@/lib/api/types';

type Props = {
  standingsRows: StandingRow[];
  isLoading: boolean;
  isError: boolean;
};

export function FootballSidebarStandingsPanel({
  standingsRows,
  isLoading,
  isError,
}: Props) {
  const tFootball = useTranslations('football');

  return (
    <div className="border-l-4 border-l-red-600 bg-gradient-to-b from-black to-neutral-950 border border-neutral-800 shadow-lg shadow-black/40">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-red-500/90 font-bold">
          {tFootball('competition')}
        </p>
        <p className="mt-1 text-lg font-bold text-white leading-tight">
          {tFootball('table')}
        </p>
      </div>
      <div className="p-2">
        {isLoading && (
          <p className="px-2 py-6 text-center text-xs text-neutral-500">
            {tFootball('loadingTable')}
          </p>
        )}
        {isError && (
          <p className="px-2 py-4 text-xs text-red-400/90">
            {tFootball('tableError')}
          </p>
        )}
        {standingsRows.length > 0 && (
          <FootballStandingsTable rows={standingsRows} />
        )}
        {standingsRows.length === 0 && !isLoading && !isError && (
          <p className="px-2 py-4 text-xs text-neutral-500 text-center">
            {tFootball('tableEmpty')}
          </p>
        )}
      </div>
    </div>
  );
}
