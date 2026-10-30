import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/routing';
import { isApiError } from '@/lib/api/http';
import { matchTitle } from '@/lib/football/match-title';
import { formatDateTime } from '@/lib/i18n/date-time';
import { makeQueryClient } from '@/lib/query/queryClient';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { matchShareCardHref } from '@/lib/seo/share-card';
import { fetchMatchDetail, matchDetailQueryOptions } from '@/hooks/useFootball';
import { MatchDetailView } from './MatchDetailView';

type Props = { params: Promise<{ locale: string; id: string }> };

/** Один запит до API на рендер: матч читають і `generateMetadata`, і сторінка. */
const getMatchDetail = cache(fetchMatchDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isAppLocale(locale)) return {};
  try {
    const match = await getMatchDetail(id);
    const t = await getTranslations({ locale, namespace: 'match' });
    const tMeta = await getTranslations({ locale, namespace: 'meta' });
    // Дата початку — у поясі читача (cookie `tz`), як на сторінці; пошуковик бачить пояс за замовчуванням
    const kickoffDate = formatDateTime(
      match.kickoffAt,
      locale,
      await getTimeZone(),
      { dateStyle: 'long' },
    );
    return pageMetadata({
      locale,
      href: `/matches/${match.id}`,
      title: `${matchTitle(match)} · ${match.league.name}`,
      description: t('metaDescription', {
        home: match.homeClub.name,
        away: match.awayClub.name,
        league: match.league.name,
        date: kickoffDate,
      }),
      siteName: tMeta('title'),
      shareCardHref: matchShareCardHref(match.id),
    });
  } catch (error) {
    // 404 — сторінка покаже загальну `app/not-found.tsx`; заголовок вкладки — той самий
    if (isApiError(error) && error.status === 404) {
      const tNotFound = await getTranslations({
        locale,
        namespace: 'notFound',
      });
      return { title: tNotFound('title') };
    }
    return {};
  }
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const queryClient = makeQueryClient();

  // `fetchQuery`, а не `prefetchQuery` (той ковтає помилки): невідомий матч → HTTP 404,
  // як у новини. Інші збої — рендер без кешу, клієнт зробить refetch
  try {
    await queryClient.fetchQuery({
      ...matchDetailQueryOptions(id),
      queryFn: () => getMatchDetail(id),
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
  }

  return (
    <main className="min-h-[60vh]">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MatchDetailView matchId={id} />
      </HydrationBoundary>
    </main>
  );
}
