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
  matchesSearchPage,
  parseMatchesPageParams,
  type MatchesPageSearchParams,
} from '@/lib/football/matches-page';
import { dayKeyInTimeZone, zonedDayRange } from '@/lib/i18n/zoned-date';
import { makeQueryClient } from '@/lib/query/queryClient';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { pageShareCardHref } from '@/lib/seo/share-card';
import { MatchesDayView } from './MatchesDayView';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<MatchesPageSearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'matches' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  // День чи ліга в адресі — `noindex` (M1.8.1)
  const { href, isIndexable } = matchesSearchPage(await searchParams);
  return pageMetadata({
    locale,
    href,
    isIndexable,
    title: t('title'),
    description: t('metaDescription'),
    siteName: tMeta('title'),
    shareCardHref: pageShareCardHref('matches'),
  });
}

/**
 * Матчі дня в усіх активних турнірах (або одному, `?league=`). День — `?date=YYYY-MM-DD` у поясі
 * користувача (next-intl, cookie `tz`), без нього — сьогодні; межі дня → UTC-миттєвості для API
 * (🧭 п. 3). Невалідні `date` / `league` — сьогодні / усі турніри, без 404.
 */
export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const pageParams = parseMatchesPageParams(await searchParams);

  const timeZone = await getTimeZone();
  const todayKey = dayKeyInTimeZone(new Date(), timeZone);
  const dayKey = pageParams.dayKey ?? todayKey;
  const { leagueSlug } = pageParams;
  const { from, to } = zonedDayRange(dayKey, timeZone);

  // prefetchQuery не кидає: що не завантажилось — клієнт дотягне сам
  const queryClient = makeQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(leaguesQueryOptions()),
    queryClient.prefetchQuery(matchesInRangeQueryOptions(from, to, leagueSlug)),
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
