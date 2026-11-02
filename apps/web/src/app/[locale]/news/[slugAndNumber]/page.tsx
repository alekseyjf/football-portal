import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { isApiError } from '@/lib/api/http';
import type { PostDetail } from '@/lib/api/types';
import { localeToApiContentLang, localeToBcp47 } from '@/lib/i18n/content-lang';
import { postJsonLd } from '@/lib/news/post-json-ld';
import { postMetadata } from '@/lib/news/post-metadata';
import {
  parsePostPathSegment,
  postHref,
  postPathSegment,
} from '@/lib/news/post-path';
import { makeQueryClient } from '@/lib/query/queryClient';
import { siteUrl } from '@/lib/site-url';
import { fetchPostDetail, postDetailQueryOptions } from '@/hooks/usePostDetail';
import { permanentRedirect } from '@/i18n/navigation';
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
    const tMeta = await getTranslations({ locale, namespace: 'meta' });
    return postMetadata(post, {
      locale,
      siteName: tMeta('title'),
      collator: new Intl.Collator(localeToBcp47(locale)),
    });
  } catch (error) {
    // 404 — сторінка покаже загальну `app/not-found.tsx`; заголовок вкладки — той самий
    if (isApiError(error) && error.status === 404) {
      return { title: tNotFound('title') };
    }
    const tNews = await getTranslations({ locale, namespace: 'news' });
    return { title: tNews('loadError') };
  }
}

/** Структуровані дані новини (`postJsonLd`): тексти мовою сторінки й адреса сайту — серверна `SITE_URL`. */
async function PostJsonLd({
  locale,
  post,
}: {
  locale: AppLocale;
  post: PostDetail;
}) {
  const tCrumbs = await getTranslations({
    locale,
    namespace: 'news.breadcrumbs',
  });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });
  const { article, breadcrumbs } = postJsonLd(post, {
    locale,
    siteOrigin: siteUrl(),
    siteName: tMeta('title'),
    breadcrumbNames: { home: tCrumbs('home'), news: tCrumbs('news') },
  });
  return (
    <>
      <JsonLd data={article} />
      <JsonLd data={breadcrumbs} />
    </>
  );
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
    permanentRedirect({ href: postHref(post), locale });
  }

  return (
    <>
      {post && <PostJsonLd locale={locale} post={post} />}
      <HydrationBoundary state={dehydrate(queryClient)}>
        {/* Адреса сайту — з серверної змінної: клієнту вона потрібна лише тут, для «своїх» посилань тексту */}
        <NewsPostView postNumber={postRef.number} siteUrl={siteUrl()} />
      </HydrationBoundary>
    </>
  );
}
