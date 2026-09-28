import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/routing';
import {
  leaguesQueryOptions,
  matchesInRangeQueryOptions,
} from '@/hooks/useFootball';
import {
  isLeagueSlug,
  leagueSlugFromParam,
} from '@/lib/football/league-param';
import {
  dayKeyInTimeZone,
  isDayKey,
  zonedDayRange,
} from '@/lib/i18n/zoned-date';
import { makeQueryClient } from '@/lib/query/queryClient';
import { MatchesDayView } from './MatchesDayView';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    date?: string | string[];
    league?: string | string[];
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'matches' });
  return { title: t('title') };
}

/**
 * Матчі дня в усіх активних турнірах (або одному, `?league=`). День — `?date=YYYY-MM-DD` у поясі
 * користувача (next-intl, cookie `tz`), без нього — сьогодні; межі дня → UTC-миттєвості для API
 * (🧭 п. 3). Невалідні `date` / `league` — сьогодні / усі турніри, без 404.
 */
export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const { date, league } = await searchParams;

  const timeZone = await getTimeZone();
  const todayKey = dayKeyInTimeZone(new Date(), timeZone);
  const dateParam = Array.isArray(date) ? date[0] : date;
  const dayKey = dateParam && isDayKey(dateParam) ? dateParam : todayKey;
  const leagueParam = leagueSlugFromParam(league);
  const leagueSlug =
    leagueParam && isLeagueSlug(leagueParam) ? leagueParam : null;
  const { from, to } = zonedDayRange(dayKey, timeZone);

  // prefetchQuery не кидає: що не завантажилось — клієнт дотягне сам
  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(leaguesQueryOptions()),
    queryClient.prefetchQuery(
      matchesInRangeQueryOptions(from, to, leagueSlug),
    ),
  ]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MatchesDayView
          dayKey={dayKey}
          todayKey={todayKey}
          from={from}
          to={to}
          leagueSlug={leagueSlug}
        />
      </HydrationBoundary>
    </main>
  );
}
