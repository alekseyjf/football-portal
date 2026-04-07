import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/http';
import { makeQueryClient } from '@/lib/query/queryClient';
import {
  DEFAULT_CONTENT_LANG,
  getTranslation,
  type PostDetail,
} from '@/lib/api/types';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { NewsPostView } from './NewsPostView';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await apiGet<PostDetail>(
      `/posts/${encodeURIComponent(slug)}?lang=${DEFAULT_CONTENT_LANG}`,
    );
    const t = getTranslation(post, DEFAULT_CONTENT_LANG);
    return {
      title: t.title,
      description: t.excerpt,
    };
  } catch {
    return { title: 'Post not found' };
  }
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const queryClient = makeQueryClient();

  try {
    await queryClient.prefetchQuery(
      postDetailQueryOptions(slug, DEFAULT_CONTENT_LANG),
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
