import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FootballSidebar } from '@/components/football/FootballSidebar';
import { HomeNews } from '@/components/home/HomeNews';
import { JsonLd } from '@/components/seo/JsonLd';
import { getPathname } from '@/i18n/navigation';
import { isAppLocale, type AppLocale } from '@/i18n/routing';
import {
  leagueDashboardQueryOptions,
  leaguesQueryOptions,
} from '@/hooks/useFootball';
import { homeNewsQueryOptions } from '@/hooks/useHomeNews';
import { resolveDefaultLeagueSlug } from '@/lib/football/default-league';
import { leagueSlugFromParam } from '@/lib/football/league-param';
import { isHomeApiDown } from '@/lib/home/home-blocks';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import { organizationJsonLd, webSiteJsonLd } from '@/lib/seo/json-ld';
import { absoluteSiteUrl, siteUrl } from '@/lib/site-url';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'home' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const title = t('metaTitle');
  const description = t('metaDescription');
  // canonical, hreflang і `og:locale` — M1.8 (спільний хелпер, frontend Rule 14)
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: 'website',
      siteName: tMeta('title'),
      title,
      description,
    },
  };
}

/** `WebSite` і `Organization` (D55): назва сайту для результатів пошуку й видання; адреси — повні (`SITE_URL`). */
async function homeJsonLd(locale: AppLocale) {
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const publisher = { name: tMeta('title'), url: siteUrl() };
  return [
    webSiteJsonLd({
      name: tMeta('title'),
      url: absoluteSiteUrl(getPathname({ href: '/', locale })),
      inLanguage: locale,
      publisher,
    }),
    organizationJsonLd(publisher),
  ];
}

/**
 * Головна (M1.6.3, D55): останні новини й сайдбар обраної ліги (`?league=`, без нього — ліга за замовчуванням). Блоки
 * незалежні: сервер чекає всіх запитів, а що не завантажилось — клієнт дотягне сам, зі своїм скелетоном і «Спробувати
 * ще» в блоці; API недоступне для всіх запитів — `error.tsx`.
 */
export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const { league } = await searchParams;
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();
  const t = await getTranslations({ locale, namespace: 'home' });

  // Список ліг — і для перемикача (гідрується разом з рештою), і для ліги за замовчуванням; новини — паралельно
  const [leaguesResult, newsResult] = await Promise.allSettled([
    queryClient.fetchQuery(leaguesQueryOptions()),
    queryClient.fetchQuery(homeNewsQueryOptions(contentLang)),
  ]);
  const defaultLeagueSlug = resolveDefaultLeagueSlug(
    leaguesResult.status === 'fulfilled' ? leaguesResult.value : null,
  );
  const leagueSlug = leagueSlugFromParam(league) ?? defaultLeagueSlug;
  const dashboardResults = await Promise.allSettled(
    leagueSlug
      ? [queryClient.fetchQuery(leagueDashboardQueryOptions(leagueSlug))]
      : [],
  );
  if (isHomeApiDown([leaguesResult, newsResult, ...dashboardResults])) {
    throw new Error('HOME_API_UNAVAILABLE');
  }

  return (
    <>
      {(await homeJsonLd(locale)).map((data) => (
        <JsonLd key={String(data['@type'])} data={data} />
      ))}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Один h1 на сторінку — для диктора й пошуку; видимі заголовки — у блоків (h2) */}
        <h1 className="sr-only">{t('title')}</h1>
        {/* Одна межа гідрації на всі блоки: сайдбар у SSR має бачити дані дашборду, а не скелетон */}
        <HydrationBoundary state={dehydrate(queryClient)}>
          {/* Порядок — лише в DOM, без CSS `order` (за ним ідуть Tab і диктор): новини → сайдбар; на десктопі
              сайдбар праворуч, тож і на екрані порядок той самий (D55) */}
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
            <HomeNews />
            <aside className="lg:sticky lg:top-20">
              <FootballSidebar defaultLeagueSlug={defaultLeagueSlug} />
            </aside>
          </div>
        </HydrationBoundary>
      </main>
    </>
  );
}
