'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  contentLangToBcp47,
  contentLanguageName,
  localeToBcp47,
} from '@/lib/i18n/content-lang';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { LikeBar } from '@/components/features/LikeBar';
import { CommentSection } from './CommentSection';

export function NewsPostView({ slug }: { slug: string }) {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('news');
  const authorDisplayName = useAuthorDisplayName();

  const { data: post, isLoading, isError } = useQuery(
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
        <p className="text-red-400">{t('loadError')}</p>
      </main>
    );
  }

  const isFallback = post.resolvedLanguage !== contentLang;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {isFallback && (
        <p
          role="note"
          className="mb-6 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300"
        >
          {t('translationUnavailable', {
            language: contentLanguageName(post.resolvedLanguage, locale),
          })}
        </p>
      )}

      <article lang={contentLangToBcp47(post.resolvedLanguage)}>
        {post.coverImageUrl && (
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="w-full h-64 object-cover rounded-2xl mb-6"
          />
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3">{post.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>
              {t('by')} {authorDisplayName(post.author)}
            </span>
            <span>·</span>
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(dateLocale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
        </div>

        <p className="text-gray-300 text-lg leading-relaxed mb-6 border-l-4 border-green-500 pl-4 italic">
          {post.excerpt}
        </p>

        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {post.content}
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
