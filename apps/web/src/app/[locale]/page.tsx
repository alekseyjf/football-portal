import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FootballSidebar } from '@/components/football/FootballSidebar';
import { isAppLocale } from '@/i18n/routing';
import { leagueDashboardQueryOptions } from '@/hooks/useFootball';
import { postsQueryOptions } from '@/hooks/usePosts';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import { HomeFeed } from '../HomeFeed';
import { resolveDefaultLeagueSlug } from '../resolveDefaultLeagueSlug';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();
  const leagueSlug = await resolveDefaultLeagueSlug();
  const t = await getTranslations({ locale, namespace: 'home' });

  try {
    await queryClient.prefetchQuery(postsQueryOptions(1, 6, contentLang));
  } catch {
    // HomeFeed зробить refetch
  }

  if (leagueSlug) {
    try {
      await queryClient.prefetchQuery(leagueDashboardQueryOptions(leagueSlug));
    } catch {
      // FootballSidebar підвантажить на клієнті
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr] gap-8 lg:gap-10 items-start">
        <aside className="lg:sticky lg:top-20 order-2 lg:order-1">
          <FootballSidebar leagueSlug={leagueSlug} />
        </aside>

        <div className="space-y-10 order-1 lg:order-2 min-w-0">
          <section className="text-center py-14 px-4 bg-gradient-to-br from-neutral-950 via-green-950/40 to-emerald-950/30 border border-neutral-800 border-l-4 border-l-red-600">
            <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-white tracking-tight">
              ⚽ {t('title')}
            </h1>
            <p className="text-lg text-neutral-400 max-w-xl mx-auto">
              {t.rich('subtitle', {
                site: (chunks) => (
                  <a
                    href="https://www.bayer04.de/de-de#spielplan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 underline-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>

          <HydrationBoundary state={dehydrate(queryClient)}>
            <HomeFeed />
          </HydrationBoundary>
        </div>
      </div>
    </main>
  );
}
