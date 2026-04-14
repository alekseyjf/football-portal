'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { getTranslation } from '@/lib/api/types';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { LikeBar } from '@/components/features/LikeBar';
import { CommentSection } from './CommentSection';

export function NewsPostView({ slug }: { slug: string }) {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('news');

  const { data: post, isLoading, isError, error } = useQuery(
    postDetailQueryOptions(slug, contentLang),
  );

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-400">{t('loading')}</p>
      </main>
    );
  }

  if (isError || !post) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-400">
          {error instanceof Error ? error.message : t('loadError')}
        </p>
      </main>
    );
  }

  const translation = getTranslation(post, contentLang);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <article>
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={translation.title}
            className="w-full h-64 object-cover rounded-2xl mb-6"
          />
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3">{translation.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>
              {t('by')} {post.author.name}
            </span>
            <span>·</span>
            <time>
              {new Date(post.createdAt).toLocaleDateString(dateLocale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
        </div>

        <p className="text-gray-300 text-lg leading-relaxed mb-6 border-l-4 border-green-500 pl-4 italic">
          {translation.excerpt}
        </p>

        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {translation.content ?? ''}
          </p>
        </div>

        <div className="mt-8 flex items-center">
          <LikeBar targetType="post" targetId={post.id} />
        </div>
      </article>

      <hr className="border-gray-800 my-10" />

      <CommentSection postId={post.id} />
    </main>
  );
}
