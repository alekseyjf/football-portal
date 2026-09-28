'use client';

import { useTranslations } from 'next-intl';
import { FootballStandingsTable } from './FootballStandingsTable';
import { useFootballStageLabels } from '@/hooks/useFootballStageLabels';
import type { LeagueDashboardResponse, StandingRow } from '@/lib/api/types';

type Props = {
  standingsRows: StandingRow[];
  /** Яка це таблиця — для заголовка: ліга / ліга-фаза / група */
  standingsTable: LeagueDashboardResponse['standingsTable'];
  /** `null` — турнір ще не синкали */
  seasonLabel: string | null;
  isLoading: boolean;
  isError: boolean;
};

export function FootballSidebarStandingsPanel({
  standingsRows,
  standingsTable,
  seasonLabel,
  isLoading,
  isError,
}: Props) {
  const tFootball = useTranslations('football');
  const { stageLabel, groupLabel } = useFootballStageLabels();

  const tableTitle =
    !standingsTable || standingsTable.stage === 'REGULAR_SEASON'
      ? tFootball('table')
      : standingsTable.groupName
        ? groupLabel(standingsTable.groupName)
        : stageLabel(standingsTable.stage);

  return (
    <div className="border-l-4 border-l-red-600 bg-gradient-to-b from-black to-neutral-950 border border-neutral-800 shadow-lg shadow-black/40">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-red-500/90 font-bold">
          {seasonLabel
            ? tFootball('seasonLabel', { label: seasonLabel })
            : tFootball('competition')}
        </p>
        <p className="mt-1 text-lg font-bold text-white leading-tight">
          {tableTitle}
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
            {/* Сезон є, а таблиці немає — її не дає провайдер (EC 2024), синк тут не допоможе */}
            {seasonLabel
              ? tFootball('tableUnavailable')
              : tFootball('tableEmpty')}
          </p>
        )}
      </div>
    </div>
  );
}
