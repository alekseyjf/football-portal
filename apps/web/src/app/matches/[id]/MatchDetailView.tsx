'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  footballKeys,
  matchDetailQueryOptions,
  requestLiveTouch,
} from '@/hooks/useFootball';
import type { MatchDetail, MatchStatusDto } from '@/lib/api/types';

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

export function MatchDetailView({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const liveTouchSent = useRef(false);

  const { data: match, isLoading, isError } = useQuery({
    ...matchDetailQueryOptions(matchId),
    refetchInterval: (q) =>
      (q.state.data as MatchDetail | undefined)?.status === 'LIVE'
        ? 45_000
        : false,
  });

  useEffect(() => {
    if (!match || match.status !== 'LIVE' || liveTouchSent.current) return;
    liveTouchSent.current = true;
    void requestLiveTouch(matchId).then((r) => {
      if (r.accepted) {
        // Фоновий синк на API ~7–15 с; оновлюємо кеш після паузи
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: footballKeys.match(matchId) });
        }, 14_000);
      }
    });
  }, [match, matchId, qc]);

  if (isLoading) {
    return (
      <p className="text-neutral-400 text-center py-16">Завантаження матчу…</p>
    );
  }

  if (isError || !match) {
    return (
      <p className="text-red-400/90 text-center py-16">
        Матч не знайдено або помилка мережі.
      </p>
    );
  }

  const live = match.status === 'LIVE';
  const score =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} : ${match.awayScore}`
      : '— : —';

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-sm text-neutral-500 hover:text-white transition-colors mb-8 inline-block"
      >
        ← На головну
      </Link>

      <div
        className={[
          'border-l-4 border border-neutral-800 bg-neutral-950/70 p-6 sm:p-8',
          live ? 'border-l-red-600' : 'border-l-neutral-700',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider text-neutral-500 mb-4">
          <span>{match.league.name}</span>
          <span className="text-neutral-700">·</span>
          <span>{match.league.season}</span>
          {match.matchday != null && (
            <>
              <span className="text-neutral-700">·</span>
              <span>Тур {match.matchday}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span
            className={
              live
                ? 'rounded px-2 py-0.5 bg-red-600 text-white text-xs font-bold uppercase'
                : 'text-xs text-neutral-400 uppercase'
            }
          >
            {live && match.minute != null
              ? `${match.minute}′ · ${statusUk(match.status)}`
              : statusUk(match.status)}
          </span>
          <time className="text-sm text-neutral-400">
            {new Date(match.date).toLocaleString('uk-UA', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </time>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex-1 text-center sm:text-right">
            <p className="text-lg sm:text-xl font-bold text-white">
              {match.homeClub.name}
            </p>
            {match.homeClub.shortName && (
              <p className="text-xs text-neutral-500 mt-1">
                ({match.homeClub.shortName})
              </p>
            )}
          </div>

          <div className="text-4xl sm:text-5xl font-black tabular-nums text-white text-center shrink-0">
            {score}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg sm:text-xl font-bold text-white">
              {match.awayClub.name}
            </p>
            {match.awayClub.shortName && (
              <p className="text-xs text-neutral-500 mt-1">
                ({match.awayClub.shortName})
              </p>
            )}
          </div>
        </div>

        {live && (
          <p className="mt-8 text-xs text-neutral-500 border-t border-neutral-800 pt-4">
            Статус оновлюється з нашої бази; при відкритті сторінки ми один раз
            запитуємо свіжі LIVE-дані у football-data (не частіше ніж раз на 90 с
            на змагання), далі — автооновлення кожні 45 с.
          </p>
        )}
      </div>
    </article>
  );
}
