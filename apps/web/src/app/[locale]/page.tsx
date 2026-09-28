import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FootballSidebar } from '@/components/football/FootballSidebar';
import { isAppLocale } from '@/i18n/routing';
import {
  leagueDashboardQueryOptions,
  leaguesQueryOptions,
} from '@/hooks/useFootball';
import { postsQueryOptions } from '@/hooks/usePosts';
import { leagueSlugFromParam } from '@/lib/football/league-param';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import { HomeFeed } from '../HomeFeed';
import { resolveDefaultLeagueSlug } from '../resolveDefaultLeagueSlug';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const { league } = await searchParams;
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();
  const t = await getTranslations({ locale, namespace: 'home' });

  // Список ліг — і для перемикача (гідрується разом з рештою), і для ліги за замовчуванням
  const activeLeagues = await queryClient
    .fetchQuery(leaguesQueryOptions())
    .catch(() => null);
  const defaultLeagueSlug = resolveDefaultLeagueSlug(activeLeagues);
  const leagueSlug = leagueSlugFromParam(league) ?? defaultLeagueSlug;

  // prefetchQuery не кидає: що не завантажилось — HomeFeed / FootballSidebar дотягнуть на клієнті
  await Promise.all([
    queryClient.prefetchQuery(postsQueryOptions(1, 6, contentLang)),
    leagueSlug
      ? queryClient.prefetchQuery(leagueDashboardQueryOptions(leagueSlug))
      : undefined,
  ]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Одна межа гідрації на сайдбар і стрічку: сайдбар рендериться першим, і в SSR він
          має бачити дані дашборду, а не «Завантаження…» */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr] gap-8 lg:gap-10 items-start">
          <aside className="lg:sticky lg:top-20 order-2 lg:order-1">
            <FootballSidebar defaultLeagueSlug={defaultLeagueSlug} />
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

            <HomeFeed />
          </div>
        </div>
      </HydrationBoundary>
    </main>
  );
}
