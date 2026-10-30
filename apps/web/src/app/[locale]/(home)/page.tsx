import type { Metadata } from 'next';
import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getTimeZone, getTranslations } from 'next-intl/server';
import { FootballSidebar } from '@/components/football/FootballSidebar';
import { HomeMatchStrip } from '@/components/home/HomeMatchStrip';
import { HomeNews } from '@/components/home/HomeNews';
import { JsonLd } from '@/components/seo/JsonLd';
import { getPathname } from '@/i18n/navigation';
import { isAppLocale, type AppLocale } from '@/i18n/routing';
import {
  leagueDashboardQueryOptions,
  leaguesQueryOptions,
  matchesInRangeQueryOptions,
  nextKickoffQueryOptions,
} from '@/hooks/useFootball';
import { homeNewsQueryOptions } from '@/hooks/useHomeNews';
import { resolveDefaultLeagueSlug } from '@/lib/football/default-league';
import {
  matchStripDayOf,
  type MatchStripDay,
} from '@/lib/football/home-match-strip';
import { leagueSlugFromParam } from '@/lib/football/league-param';
import { isHomeApiDown } from '@/lib/home/home-blocks';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import { organizationJsonLd, webSiteJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { pageShareCardHref } from '@/lib/seo/share-card';
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
  // `?league=` лише перемикає таблицю сайдбару — це та сама сторінка: canonical завжди на головну
  return pageMetadata({
    locale,
    href: '/',
    title: t('metaTitle'),
    isTitleAbsolute: true,
    description: t('metaDescription'),
    siteName: tMeta('title'),
    shareCardHref: pageShareCardHref('home'),
  });
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
 * Сьогодні матчів немає — «Найближчі матчі»: день найближчого матчу в поясі читача й матчі цього дня. Збій тут сторінку
 * не валить: API вже відповіло на матчі сьогодні, а чого бракує — дотягне клієнт.
 */
async function prefetchUpcomingMatchDay(
  queryClient: QueryClient,
  today: MatchStripDay,
  timeZone: string,
): Promise<void> {
  const nextKickoff = await queryClient
    .fetchQuery(nextKickoffQueryOptions(today.to))
    .catch(() => null);
  if (!nextKickoff?.kickoffAt) return;
  const day = matchStripDayOf(new Date(nextKickoff.kickoffAt), timeZone);
  await queryClient.prefetchQuery(
    matchesInRangeQueryOptions(day.from, day.to, null),
  );
}

/**
 * Головна (M1.6.3, D55): стрічка матчів дня, останні новини й сайдбар обраної ліги (`?league=`, без нього — ліга за
 * замовчуванням). Блоки незалежні: сервер чекає всіх запитів, а що не завантажилось — клієнт дотягне сам, зі своїм
 * скелетоном і «Спробувати ще» в блоці; API недоступне для всіх запитів — `error.tsx`.
 */
export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const { league } = await searchParams;
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();
  const t = await getTranslations({ locale, namespace: 'home' });
  // «Сьогодні» — у поясі читача (cookie `tz`, 🧭 п. 14); клієнт бере цей самий день з пропса
  const timeZone = await getTimeZone();
  const today = matchStripDayOf(new Date(), timeZone);

  // Список ліг — і для перемикача (гідрується разом з рештою), і для ліги за замовчуванням; новини й матчі — паралельно
  const [leaguesResult, newsResult, todayMatchesResult] =
    await Promise.allSettled([
      queryClient.fetchQuery(leaguesQueryOptions()),
      queryClient.fetchQuery(homeNewsQueryOptions(contentLang)),
      queryClient.fetchQuery(
        matchesInRangeQueryOptions(today.from, today.to, null),
      ),
    ]);
  const defaultLeagueSlug = resolveDefaultLeagueSlug(
    leaguesResult.status === 'fulfilled' ? leaguesResult.value : null,
  );
  const leagueSlug = leagueSlugFromParam(league) ?? defaultLeagueSlug;
  const isTodayEmpty =
    todayMatchesResult.status === 'fulfilled' &&
    todayMatchesResult.value.matches.length === 0;
  const [dashboardResults] = await Promise.all([
    Promise.allSettled(
      leagueSlug
        ? [queryClient.fetchQuery(leagueDashboardQueryOptions(leagueSlug))]
        : [],
    ),
    isTodayEmpty
      ? prefetchUpcomingMatchDay(queryClient, today, timeZone)
      : undefined,
  ]);
  if (
    isHomeApiDown([
      leaguesResult,
      newsResult,
      todayMatchesResult,
      ...dashboardResults,
    ])
  ) {
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
          {/* Порядок — лише в DOM, без CSS `order` (за ним ідуть Tab і диктор): матчі → новини → сайдбар; на
              десктопі сайдбар праворуч, тож і на екрані порядок той самий (D55) */}
          <HomeMatchStrip today={today} />
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
