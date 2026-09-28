import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { isAppLocale } from '@/i18n/routing';
import { isApiError } from '@/lib/api/http';
import { makeQueryClient } from '@/lib/query/queryClient';
import {
  fetchMatchDetail,
  matchDetailQueryOptions,
} from '@/hooks/useFootball';
import { MatchDetailView } from './MatchDetailView';

type Props = { params: Promise<{ locale: string; id: string }> };

/** Один запит до API на рендер: матч читають і `generateMetadata`, і сторінка. */
const getMatchDetail = cache(fetchMatchDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isAppLocale(locale)) return {};
  try {
    const match = await getMatchDetail(id);
    return {
      title: `${match.homeClub.name} – ${match.awayClub.name} · ${match.league.name}`,
    };
  } catch (error) {
    // 404 — сторінка покаже загальну `app/not-found.tsx`; заголовок вкладки — той самий
    if (isApiError(error) && error.status === 404) {
      const tNotFound = await getTranslations({ locale, namespace: 'notFound' });
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
