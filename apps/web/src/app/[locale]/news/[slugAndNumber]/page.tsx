import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { isApiError } from '@/lib/api/http';
import type { PostDetail } from '@/lib/api/types';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { parsePostPathSegment, postPathSegment } from '@/lib/news/post-path';
import { makeQueryClient } from '@/lib/query/queryClient';
import { fetchPostDetail, postDetailQueryOptions } from '@/hooks/usePostDetail';
import { permanentRedirect } from '@/i18n/navigation';
import { isAppLocale } from '@/i18n/routing';
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
    return {
      title: post.title,
      description: post.excerpt,
    };
  } catch (error) {
    // 404 — сторінка покаже загальну `app/not-found.tsx`; заголовок вкладки — той самий
    if (isApiError(error) && error.status === 404) {
      return { title: tNotFound('title') };
    }
    const tNews = await getTranslations({ locale, namespace: 'news' });
    return { title: tNews('loadError') };
  }
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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewsPostView postNumber={postRef.number} />
    </HydrationBoundary>
  );
}
