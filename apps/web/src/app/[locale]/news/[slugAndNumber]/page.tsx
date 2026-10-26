import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { isApiError } from '@/lib/api/http';
import type { PostDetail } from '@/lib/api/types';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { postMetadata } from '@/lib/news/post-metadata';
import { parsePostPathSegment, postPathSegment } from '@/lib/news/post-path';
import { makeQueryClient } from '@/lib/query/queryClient';
import { breadcrumbListJsonLd, newsArticleJsonLd } from '@/lib/seo/json-ld';
import { absoluteSiteUrl, siteUrl } from '@/lib/site-url';
import { fetchPostDetail, postDetailQueryOptions } from '@/hooks/usePostDetail';
import { getPathname, permanentRedirect } from '@/i18n/navigation';
import { isAppLocale, type AppLocale } from '@/i18n/routing';
import { NewsPostView } from './NewsPostView';

/** `slugAndNumber` — сегмент `{slug}-{number}` (D24): новину визначає номер. */
type Props = { params: Promise<{ locale: string; slugAndNumber: string }> };

/** Один запит до API на рендер: новину читають і `generateMetadata`, і сторінка. */
const getPostDetail = cache(fetchPostDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slugAndNumber } = await params;
  if (!isAppLocale(locale)) {
    return { title: 'Post' };
  }
  const tNotFound = await getTranslations({ locale, namespace: 'notFound' });
  const postRef = parsePostPathSegment(slugAndNumber);
  if (!postRef) return { title: tNotFound('title') };

  try {
    const post = await getPostDetail(
      postRef.number,
      localeToApiContentLang(locale),
    );
    return postMetadata(post);
  } catch (error) {
    // 404 — сторінка покаже загальну `app/not-found.tsx`; заголовок вкладки — той самий
    if (isApiError(error) && error.status === 404) {
      return { title: tNotFound('title') };
    }
    const tNews = await getTranslations({ locale, namespace: 'news' });
    return { title: tNews('loadError') };
  }
}

/**
 * Структуровані дані новини (D34, D53): `NewsArticle` і `BreadcrumbList` — ті самі пункти й назви, що й видимі
 * хлібні крихти (`PostBreadcrumbs`). Адреси — повні (`SITE_URL`).
 */
async function postJsonLd(locale: AppLocale, post: PostDetail) {
  const tCrumbs = await getTranslations({ locale, namespace: 'news.breadcrumbs' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const pageUrl = absoluteSiteUrl(
    getPathname({ href: `/news/${postPathSegment(post)}`, locale }),
  );
  return [
    newsArticleJsonLd({
      url: pageUrl,
      headline: post.title,
      description: post.excerpt,
      imageUrl: post.coverImageUrl,
      datePublished: post.publishedAt,
      authorName: post.author.isDeleted ? null : post.author.name,
      publisher: { name: tMeta('title'), url: siteUrl() },
      inLanguage: post.resolvedLanguage,
      sourceUrl: post.sourceUrl,
    }),
    breadcrumbListJsonLd([
      { name: tCrumbs('home'), url: absoluteSiteUrl(getPathname({ href: '/', locale })) },
      {
        name: tCrumbs('news'),
        url: absoluteSiteUrl(getPathname({ href: '/news', locale })),
      },
      { name: post.title },
    ]),
  ];
}

export default async function NewsPostPage({ params }: Props) {
  const { locale, slugAndNumber } = await params;
  const postRef = parsePostPathSegment(slugAndNumber);
  if (!isAppLocale(locale) || !postRef) {
    notFound();
  }
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();

  // `fetchQuery`, а не `prefetchQuery`: той ковтає помилки, і відсутній пост / чернетка
  // віддавали HTTP 200 із «Завантаження…». 404 від API → сторінка 404; інші збої —
  // рендеримо без кешу, клієнт зробить refetch
  let post: PostDetail | undefined;
  try {
    post = await queryClient.fetchQuery({
      ...postDetailQueryOptions(postRef.number, contentLang),
      queryFn: () => getPostDetail(postRef.number, contentLang),
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
  }

  // Старий чи невірний slug → 308 на канонічну адресу (D24). Поза `try`: редирект — теж виняток
  if (post && postPathSegment(post) !== slugAndNumber) {
    permanentRedirect({ href: `/news/${postPathSegment(post)}`, locale });
  }

  return (
    <>
      {post &&
        (await postJsonLd(locale, post)).map((data) => (
          <JsonLd key={String(data['@type'])} data={data} />
        ))}
      <HydrationBoundary state={dehydrate(queryClient)}>
        {/* Адреса сайту — з серверної змінної: клієнту вона потрібна лише тут, для «своїх» посилань тексту */}
        <NewsPostView postNumber={postRef.number} siteUrl={siteUrl()} />
      </HydrationBoundary>
    </>
  );
}
