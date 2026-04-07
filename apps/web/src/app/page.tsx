import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { FootballSidebar } from '@/components/football/FootballSidebar';
import { leagueDashboardQueryOptions } from '@/hooks/useFootball';
import { postsQueryOptions } from '@/hooks/usePosts';
import { DEFAULT_CONTENT_LANG } from '@/lib/api/types';
import { makeQueryClient } from '@/lib/query/queryClient';
import { HomeFeed } from './HomeFeed';
import { resolveDefaultLeagueSlug } from './resolveDefaultLeagueSlug';

export default async function HomePage() {
  const queryClient = makeQueryClient();
  const leagueSlug = await resolveDefaultLeagueSlug();

  try {
    await queryClient.prefetchQuery(
      postsQueryOptions(1, 6, DEFAULT_CONTENT_LANG),
    );
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
              ⚽ Football Portal
            </h1>
            <p className="text-lg text-neutral-400 max-w-xl mx-auto">
              Новини в центрі, таблиця та розклад турів — зліва (як на клубних
              сайтах на кшталт{' '}
              <a
                href="https://www.bayer04.de/de-de#spielplan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 hover:text-red-300 underline-offset-2"
              >
                Bayer 04
              </a>
              ).
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
