'use client';

import { useTranslations } from 'next-intl';
import type { StandingRow } from '@/lib/api/types';

type Props = {
  rows: StandingRow[];
};

export function FootballStandingsTable({ rows }: Props) {
  const tFootball = useTranslations('football');

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto border border-neutral-800 bg-neutral-950/60">
      <table className="w-full text-left text-[11px] text-neutral-300">
        <thead>
          <tr className="border-b border-neutral-800 bg-black/70 text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="px-2 py-2 w-6">{tFootball('colPosition')}</th>
            <th className="px-2 py-2">{tFootball('colTeam')}</th>
            <th className="px-1 py-2 text-center">{tFootball('colPlayed')}</th>
            <th className="px-1 py-2 text-center">{tFootball('colGd')}</th>
            <th className="px-2 py-2 text-right font-semibold text-white">
              {tFootball('colPoints')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.club.id}
              className="border-b border-neutral-800/80 hover:bg-neutral-900/50"
            >
              <td className="px-2 py-1.5 tabular-nums text-neutral-500">
                {row.position}
              </td>
              <td className="px-2 py-1.5 font-medium text-neutral-100 truncate max-w-[120px]">
                {row.club.shortName ?? row.club.name}
              </td>
              <td className="px-1 py-1.5 text-center tabular-nums">
                {row.played}
              </td>
              <td className="px-1 py-1.5 text-center tabular-nums text-neutral-500">
                {row.goalsFor}:{row.goalsAgainst}
              </td>
              <td className="px-2 py-1.5 text-right font-bold tabular-nums text-white">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
