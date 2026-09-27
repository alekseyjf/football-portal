'use client';

import { Fragment, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  footballKeys,
  matchDetailQueryOptions,
  requestLiveTouch,
} from '@/hooks/useFootball';
import { useFootballStageLabels } from '@/hooks/useFootballStageLabels';
import {
  isMatchInPlay,
  isMatchTerminal,
  useMatchStatusLabel,
} from '@/hooks/useMatchStatusLabel';
import type { MatchDetail } from '@/lib/api/types';
import { LEAGUE_QUERY_PARAM } from '@/lib/football/league-param';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import { LikeBar } from '@/components/features/LikeBar';

export function MatchDetailView({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const liveTouchSent = useRef(false);
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('match');
  const formatStatus = useMatchStatusLabel();
  const { stageRoundLabel, groupLabel } = useFootballStageLabels();

  const { data: match, isLoading, isError } = useQuery({
    ...matchDetailQueryOptions(matchId),
    refetchInterval: (query) => {
      const status = (query.state.data as MatchDetail | undefined)?.status;
      return status && isMatchInPlay(status) ? 45_000 : false;
    },
  });

  // Незавершений матч: LIVE-вікно перевіряє API (P5-12) — так оновиться й матч, що вже
  // почався, але в БД ще SCHEDULED
  useEffect(() => {
    if (!match || isMatchTerminal(match.status) || liveTouchSent.current) {
      return;
    }
    liveTouchSent.current = true;
    requestLiveTouch(matchId)
      .then((response) => {
        if (response.accepted) {
          // Фоновий синк на API ~7–15 с; оновлюємо кеш після паузи
          setTimeout(() => {
            qc.invalidateQueries({ queryKey: footballKeys.match(matchId) });
          }, 14_000);
        }
      })
      // 429 (ліміт на IP) чи мережа — сторінка лишається з даними з БД
      .catch(() => undefined);
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

  const live = isMatchInPlay(match.status);
  const hasPenalties =
    match.homePenalties != null && match.awayPenalties != null;
  const score =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} : ${match.awayScore}`
      : '— : —';
  // Ліга — «Тур 6»; кубок — стадія («Груповий етап · Тур 1», «Фінал»), а не `matchday`
  // плей-оф (у EC фінал — `matchday` 7)
  const roundContext =
    match.stage !== 'REGULAR_SEASON'
      ? stageRoundLabel(match.stage, match.matchday)
      : match.matchday != null
        ? t('matchday', { n: String(match.matchday) })
        : null;
  const headerContext = [
    match.league.name,
    match.season.label,
    roundContext,
    match.groupName ? groupLabel(match.groupName) : null,
  ].filter((contextPart): contextPart is string => Boolean(contextPart));

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      {/* На головну — з лігою цього матчу в сайдбарі */}
      <Link
        href={{
          pathname: '/',
          query: { [LEAGUE_QUERY_PARAM]: match.league.slug },
        }}
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
          {headerContext.map((contextPart, index) => (
            <Fragment key={`${index}-${contextPart}`}>
              {index > 0 && <span className="text-neutral-700">·</span>}
              <span>{contextPart}</span>
            </Fragment>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span
            className={
              live
                ? 'rounded px-2 py-0.5 bg-red-600 text-white text-xs font-bold uppercase'
                : 'text-xs text-neutral-400 uppercase'
            }
          >
            {match.status === 'LIVE' && match.minute != null
              ? `${match.minute}′ · ${formatStatus(match.status)}`
              : formatStatus(match.status)}
          </span>
          <time className="text-sm text-neutral-400">
            {new Date(match.kickoffAt).toLocaleString(dateLocale, {
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

          <div className="shrink-0 text-center">
            <div className="text-4xl sm:text-5xl font-black tabular-nums text-white">
              {score}
            </div>
            {hasPenalties && (
              <p className="mt-1 text-xs text-neutral-400 tabular-nums">
                {t('penalties', {
                  home: String(match.homePenalties),
                  away: String(match.awayPenalties),
                })}
              </p>
            )}
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

        <div className="mt-8 flex items-center border-t border-neutral-800 pt-6">
          <LikeBar targetType="match" targetId={match.id} />
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
