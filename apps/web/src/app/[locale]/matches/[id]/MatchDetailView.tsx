'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  footballKeys,
  matchDetailQueryOptions,
  requestLiveTouch,
} from '@/hooks/useFootball';
import type { MatchDetail, MatchStatusDto } from '@/lib/api/types';
import { localeToBcp47 } from '@/lib/i18n/content-lang';

export function MatchDetailView({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const liveTouchSent = useRef(false);
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('match');

  const formatStatus = (status: MatchStatusDto) => {
    const labels: Record<MatchStatusDto, string> = {
      SCHEDULED: t('status.SCHEDULED'),
      LIVE: t('status.LIVE'),
      FINISHED: t('status.FINISHED'),
      POSTPONED: t('status.POSTPONED'),
      CANCELLED: t('status.CANCELLED'),
    };
    return labels[status] ?? status;
  };

  const { data: match, isLoading, isError } = useQuery({
    ...matchDetailQueryOptions(matchId),
    refetchInterval: (query) =>
      (query.state.data as MatchDetail | undefined)?.status === 'LIVE'
        ? 45_000
        : false,
  });

  useEffect(() => {
    if (!match || match.status !== 'LIVE' || liveTouchSent.current) return;
    liveTouchSent.current = true;
    void requestLiveTouch(matchId).then((response) => {
      if (response.accepted) {
         // Фоновий синк на API ~7–15 с; оновлюємо кеш після паузи
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: footballKeys.match(matchId) });
        }, 14_000);
      }
    });
  }, [match, matchId, qc]);

  if (isLoading) {
    return (
      <p className="text-neutral-400 text-center py-16">{t('loading')}</p>
    );
  }

  if (isError || !match) {
    return (
      <p className="text-red-400/90 text-center py-16">{t('notFound')}</p>
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
        {t('backHome')}
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
              <span>{t('matchday', { n: String(match.matchday) })}</span>
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
              ? `${match.minute}′ · ${formatStatus(match.status)}`
              : formatStatus(match.status)}
          </span>
          <time className="text-sm text-neutral-400">
            {new Date(match.date).toLocaleString(dateLocale, {
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
            {t('liveNote')}
          </p>
        )}
      </div>
    </article>
  );
}
