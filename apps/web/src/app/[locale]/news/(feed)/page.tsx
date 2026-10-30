import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { permanentRedirect } from '@/i18n/navigation';
import { isAppLocale } from '@/i18n/routing';
import {
  clubQueryOptions,
  leagueQueryOptions,
  leaguesQueryOptions,
} from '@/hooks/useFootball';
import { tagQueryOptions } from '@/hooks/useTags';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import {
  newsFeedHrefWithPage,
  newsFeedSearchPage,
  parseNewsFeedFilters,
  resolveNewsFeedPage,
  type NewsFeedSearchParams,
} from '@/lib/news/news-feed-filters';
import { newsFeedQueryOptions } from '@/lib/news/news-feed-query';
import { makeQueryClient } from '@/lib/query/queryClient';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { pageShareCardHref } from '@/lib/seo/share-card';
import { NewsFeedView } from './NewsFeedView';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<NewsFeedSearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'newsFeed' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const query = await searchParams;
  const pageRequest = resolveNewsFeedPage(query.page);
  const page = pageRequest.kind === 'page' ? pageRequest.page : 1;
  // Сторінки `?page=N` індексуються (D52) — у кожної своя назва; з фільтрами — `noindex`
  const { href, isIndexable } = newsFeedSearchPage(query, page);
  return pageMetadata({
    locale,
    href,
    isIndexable,
    title: page > 1 ? t('titleWithPage', { page: String(page) }) : t('title'),
    description: t('description'),
    siteName: tMeta('title'),
    shareCardHref: pageShareCardHref('news'),
  });
}

/**
 * Стрічка новин (M1.6.1): фільтри й сторінка — в адресі (`?tags=&competition=&club=&page=`, D46, D38). Перша
 * сторінка — серверний рендер; невалідні значення фільтрів — без них; інший запис сторінки (`?page=1`, `?page=abc`) —
 * 308 на канонічну адресу, сторінки за межами стрічки — 404. Назви для вкладки ліги й чипів теж приходять із сервера.
 */
export default async function NewsFeedPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const query = await searchParams;
  const pageRequest = resolveNewsFeedPage(query.page);
  if (pageRequest.kind === 'notFound') notFound();
  // Одна сторінка — одна адреса в пошуку (D52); `permanentRedirect` — поза `try`: це теж виняток
  if (pageRequest.kind === 'redirect') {
    permanentRedirect({
      href: newsFeedHrefWithPage(query, pageRequest.page),
      locale,
    });
  }
  const startPage = pageRequest.page;
  const filters = parseNewsFeedFilters(query);
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();

  // Помилка API (крім «сторінки немає») не ламає сторінку: що не завантажилось — клієнт дотягне сам
  const [feed, activeLeagues] = await Promise.all([
    queryClient
      .fetchInfiniteQuery(newsFeedQueryOptions(filters, contentLang, startPage))
      .catch(() => null),
    queryClient.fetchQuery(leaguesQueryOptions()).catch(() => null),
    ...filters.tags.map((tagSlug) =>
      queryClient.prefetchQuery(tagQueryOptions(tagSlug, contentLang)),
    ),
    ...filters.clubs.map((clubSlug) =>
      queryClient.prefetchQuery(clubQueryOptions(clubSlug)),
    ),
  ]);

  // Сторінки за межами стрічки немає: 404, а не порожня сторінка, яку пошук прийняв би за справжню
  if (startPage > 1 && feed?.pages[0]?.data.length === 0) notFound();

  // Вибраної ліги немає серед увімкнених (ЧС після турніру) — назву вкладки дає турнір за slug
  const competition = filters.competition;
  if (
    competition &&
    activeLeagues &&
    !activeLeagues.some((league) => league.slug === competition)
  ) {
    await queryClient.prefetchQuery(leagueQueryOptions(competition));
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <NewsFeedView filters={filters} startPage={startPage} />
      </HydrationBoundary>
    </main>
  );
}
