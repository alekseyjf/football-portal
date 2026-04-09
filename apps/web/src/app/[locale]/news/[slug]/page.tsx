import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { apiGet } from '@/lib/api/http';
import { localeToApiContentLang } from '@/lib/i18n/content-lang';
import { makeQueryClient } from '@/lib/query/queryClient';
import {
  getTranslation,
  type PostDetail,
} from '@/lib/api/types';
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
    const translation = getTranslation(post, contentLang);
    return {
      title: translation.title,
      description: translation.excerpt,
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

  try {
    await queryClient.prefetchQuery(
      postDetailQueryOptions(slug, contentLang),
    );
  } catch {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NewsPostView slug={slug} />
    </HydrationBoundary>
  );
}
