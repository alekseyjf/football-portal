'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { contentLanguageName } from '@/lib/i18n/content-lang';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import { LikeBar } from '@/components/features/LikeBar';
import { CommentSection } from './CommentSection';
import { PostSourceLine } from './PostSourceLine';

export function NewsPostView({ postNumber }: { postNumber: number }) {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const formatDate = useDateTimeFormat();
  const t = useTranslations('news');
  const authorDisplayName = useAuthorDisplayName();

  const { data: post, isLoading, isError } = useQuery(
    postDetailQueryOptions(postNumber, contentLang),
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

      {/* `lang` — лише на тексті новини: без перекладу він мовою оригіналу, а «Фото:», автор і дата — мовою сторінки */}
      <article>
        {post.coverImageUrl && (
          <figure className="mb-6">
            {/* `unoptimized` — як у стрічці (довільний хост, без серверного fetch); `eager` — LCP */}
            <div
              className="relative w-full h-64 overflow-hidden rounded-2xl"
              lang={post.resolvedLanguage}
            >
              <Image
                src={post.coverImageUrl}
                // Опис — мовою тексту (D44); без нього — порожній, а не заголовок: його й так прочитає h1
                alt={post.coverImageAlt ?? ''}
                fill
                unoptimized
                loading="eager"
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
            {post.coverImageCredit && (
              <figcaption className="mt-2 text-xs text-gray-400">
                {t('photoCredit', { credit: post.coverImageCredit })}
              </figcaption>
            )}
          </figure>
        )}

        <div className="mb-6">
          <h1 lang={post.resolvedLanguage} className="text-3xl font-bold mb-3">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>
              {t('by')} {authorDisplayName(post.author)}
            </span>
            <span>·</span>
            <time dateTime={post.publishedAt}>
              {formatDate(post.publishedAt, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
        </div>

        <div lang={post.resolvedLanguage}>
          <p className="text-gray-300 text-lg leading-relaxed mb-6 border-l-4 border-green-500 pl-4 italic">
            {post.excerpt}
          </p>

          <div className="prose prose-invert max-w-none">
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          </div>
        </div>

        <PostSourceLine sourceUrl={post.sourceUrl} sourceName={post.sourceName} />

        <div className="mt-8 flex items-center">
          <LikeBar targetType="post" targetId={post.id} />
        </div>
      </article>

      <hr className="border-gray-800 my-10" />

      <CommentSection postId={post.id} />
    </main>
  );
}
