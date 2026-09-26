import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { apiGet, isApiError } from '@/lib/api/http';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import type { PostDetail } from '@/lib/api/types';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { isAppLocale } from '@/i18n/routing';
import { NewsPostView } from './NewsPostView';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const contentLang = localeToApiContentLang(locale);
  if (!isAppLocale(locale)) {
    return { title: 'Post' };
  }
  const tNews = await getTranslations({ locale, namespace: 'news' });
  try {
    const post = await apiGet<PostDetail>(
      `/posts/${encodeURIComponent(slug)}?lang=${encodeURIComponent(contentLang)}`,
    );
    return {
      title: post.title,
      description: post.excerpt,
    };
  } catch {
    return { title: tNews('loadError') };
  }
}

export default async function NewsPostPage({ params }: Props) {
  const { slug, locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const contentLang = localeToApiContentLang(locale);
  const queryClient = makeQueryClient();

  // `fetchQuery`, а не `prefetchQuery`: той ковтає помилки, і відсутній пост / чернетка
  // віддавали HTTP 200 із «Завантаження…». 404 від API → сторінка 404; інші збої —
  // рендеримо без кешу, клієнт зробить refetch
  try {
    await queryClient.fetchQuery(postDetailQueryOptions(slug, contentLang));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewsPostView slug={slug} />
    </HydrationBoundary>
  );
}
