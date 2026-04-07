'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { leagueDashboardQueryOptions } from '@/hooks/useFootball';
import type {
  FootballMatchRow,
  MatchStatusDto,
  StandingRow,
} from '@/lib/api/types';

function statusUk(s: MatchStatusDto): string {
  const m: Record<MatchStatusDto, string> = {
    SCHEDULED: 'Заплановано',
    LIVE: 'Наживо',
    FINISHED: 'Завершено',
    POSTPONED: 'Перенесено',
    CANCELLED: 'Скасовано',
  };
  return m[s] ?? s;
}

function formatMatchWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MatchStrip({ m }: { m: FootballMatchRow }) {
  const live = m.status === 'LIVE';
  const score =
    m.homeScore != null && m.awayScore != null
      ? `${m.homeScore} : ${m.awayScore}`
      : '— : —';

  return (
    <Link
      href={`/matches/${m.id}`}
      className={[
        'block px-3 py-2.5 border-b border-neutral-800/90 transition-colors',
        'hover:bg-neutral-900/80',
        live ? 'bg-red-950/25 border-l-2 border-l-red-600' : 'border-l-2 border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
        <span>{formatMatchWhen(m.date)}</span>
        <span
          className={
            live ? 'text-red-400 font-semibold' : 'text-neutral-500'
          }
        >
          {live && m.minute != null ? `${m.minute}′` : statusUk(m.status)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate font-medium text-neutral-100">
            {m.homeClub.shortName ?? m.homeClub.name}
          </div>
          <div className="truncate font-medium text-neutral-300">
            {m.awayClub.shortName ?? m.awayClub.name}
          </div>
        </div>
        <div className="shrink-0 tabular-nums text-base font-bold text-white">
          {score}
        </div>
      </div>
    </Link>
  );
}

function RoundBlock({
  title,
  matchday,
  matches,
}: {
  title: string;
  matchday: number | null;
  matches: FootballMatchRow[];
}) {
  const label =
    matchday != null ? `${title} · Тур ${matchday}` : `${title} · Без туру`;

  return (
    <div className="border border-neutral-800 bg-neutral-950/60">
      <div className="border-b border-neutral-800 bg-black/60 px-3 py-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </h4>
      </div>
      <div className="divide-y divide-neutral-800/50">
        {matches.map((m) => (
          <MatchStrip key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto border border-neutral-800 bg-neutral-950/60">
      <table className="w-full text-left text-[11px] text-neutral-300">
        <thead>
          <tr className="border-b border-neutral-800 bg-black/70 text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="px-2 py-2 w-6">#</th>
            <th className="px-2 py-2">Команда</th>
            <th className="px-1 py-2 text-center">І</th>
            <th className="px-1 py-2 text-center">З-П</th>
            <th className="px-2 py-2 text-right font-semibold text-white">
              Оч
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.club.id}
              className="border-b border-neutral-800/80 hover:bg-neutral-900/50"
            >
              <td className="px-2 py-1.5 tabular-nums text-neutral-500">
                {r.position}
              </td>
              <td className="px-2 py-1.5 font-medium text-neutral-100 truncate max-w-[120px]">
                {r.club.shortName ?? r.club.name}
              </td>
              <td className="px-1 py-1.5 text-center tabular-nums">
                {r.played}
              </td>
              <td className="px-1 py-1.5 text-center tabular-nums text-neutral-500">
                {r.goalsFor}:{r.goalsAgainst}
              </td>
              <td className="px-2 py-1.5 text-right font-bold tabular-nums text-white">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FootballSidebar({ leagueSlug }: { leagueSlug: string | null }) {
  const dashboard = useQuery({
    ...leagueDashboardQueryOptions(leagueSlug ?? '__none__'),
    enabled: !!leagueSlug,
  });

  if (!leagueSlug) {
    return (
      <div className="border-l-4 border-l-red-600 bg-black/85 border border-neutral-800 p-4 text-sm text-neutral-400">
        <p className="font-semibold text-neutral-200 uppercase tracking-wide text-xs mb-2">
          Турнірна таблиця
        </p>
        <p>
          Немає ліги в базі. Додайте <code className="text-neutral-500">FOOTBALL_API_KEY</code>, виконайте синк у адмінці або задайте{' '}
          <code className="text-neutral-500">NEXT_PUBLIC_DEFAULT_LEAGUE_SLUG</code>.
        </p>
      </div>
    );
  }

  const standingsRows = dashboard.data?.standings ?? [];
  const upcoming = dashboard.data?.fixtures.upcoming ?? [];
  const past = dashboard.data?.fixtures.past ?? [];

  return (
    <div className="space-y-5">
      {/* «Шпиль» як на клубних сайтах: темна панель + акцентна смуга */}
      <div className="border-l-4 border-l-red-600 bg-gradient-to-b from-black to-neutral-950 border border-neutral-800 shadow-lg shadow-black/40">
        <div className="border-b border-neutral-800 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-red-500/90 font-bold">
            Змагання
          </p>
          <p className="mt-1 text-lg font-bold text-white leading-tight">
            Таблиця
          </p>
        </div>
        <div className="p-2">
          {dashboard.isLoading && (
            <p className="px-2 py-6 text-center text-xs text-neutral-500">
              Завантаження таблиці…
            </p>
          )}
          {dashboard.isError && (
            <p className="px-2 py-4 text-xs text-red-400/90">
              Не вдалося завантажити таблицю.
            </p>
          )}
          {standingsRows.length > 0 && (
            <StandingsTable rows={standingsRows} />
          )}
          {standingsRows.length === 0 && !dashboard.isLoading && !dashboard.isError && (
            <p className="px-2 py-4 text-xs text-neutral-500 text-center">
              Таблиця порожня — потрібен синк у адмінці.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2 px-1">
          Майбутні тури
        </h3>
        <div className="space-y-3">
          {dashboard.isLoading && (
            <p className="text-xs text-neutral-500 py-4 text-center border border-neutral-800">
              Завантаження розкладу…
            </p>
          )}
          {dashboard.isError && (
            <p className="text-xs text-red-400/90 px-2">
              Не вдалося завантажити матчі.
            </p>
          )}
          {!dashboard.isLoading &&
            upcoming.map((r, i) => (
              <RoundBlock
                key={`u-${i}-${r.matches[0]?.id ?? ''}`}
                title="Майбутній"
                matchday={r.matchday}
                matches={r.matches}
              />
            ))}
          {!dashboard.isLoading && upcoming.length === 0 && (
            <p className="text-xs text-neutral-500 border border-neutral-800 px-3 py-4 text-center">
              Немає запланованих матчів у вибраній лізі.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2 px-1">
          Минулі тури
        </h3>
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {!dashboard.isLoading &&
            past.map((r, i) => (
              <RoundBlock
                key={`p-${i}-${r.matches[0]?.id ?? ''}`}
                title="Минулий"
                matchday={r.matchday}
                matches={r.matches}
              />
            ))}
          {!dashboard.isLoading && past.length === 0 && (
            <p className="text-xs text-neutral-500 border border-neutral-800 px-3 py-4 text-center">
              Ще немає завершених матчів у базі.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
