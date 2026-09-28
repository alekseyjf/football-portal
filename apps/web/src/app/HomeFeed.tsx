'use client';

import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  contentLangToBcp47,
  contentLanguageName,
} from '@/lib/i18n/content-lang';
import { postsQueryOptions } from '@/hooks/usePosts';
import { useApiContentLang } from '@/hooks/useApiContentLang';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';

export function HomeFeed() {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const formatDate = useDateTimeFormat();
  const t = useTranslations('feed');
  const authorDisplayName = useAuthorDisplayName();

  const { data: postsData, isLoading, isError } = useQuery(
    postsQueryOptions(1, 6, contentLang),
  );

  const posts = postsData?.data ?? [];

  if (isLoading) {
    return (
      <p className="text-gray-400 text-center py-12">{t('loading')}</p>
    );
  }

  if (isError) {
    return (
      <p className="text-gray-400 text-center py-12">{t('error')}</p>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{t('latestNews')}</h2>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-center py-12">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const fallbackNotice =
              post.resolvedLanguage !== contentLang
                ? t('translationUnavailable', {
                    language: contentLanguageName(post.resolvedLanguage, locale),
                  })
                : null;
            return (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="block bg-gray-900 rounded-xl overflow-hidden hover:bg-gray-800 transition-colors"
              >
                {post.coverImageUrl && (
                  // `unoptimized`: обкладинка — довільний https-хост із адмінки; оптимізація
                  // Next = серверний fetch чужого URL (SSRF, див. API `url-field.decorators.ts`)
                  <div className="relative w-full h-48">
                    <Image
                      src={post.coverImageUrl}
                      alt={post.title}
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <time dateTime={post.publishedAt} className="text-green-400">
                      {formatDate(post.publishedAt)}
                    </time>
                    {fallbackNotice && (
                      <span
                        className="uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-700 text-gray-400"
                        title={fallbackNotice}
                      >
                        <span aria-hidden="true">{post.resolvedLanguage}</span>
                        <span className="sr-only">{fallbackNotice}</span>
                      </span>
                    )}
                  </div>
                  <div lang={contentLangToBcp47(post.resolvedLanguage)}>
                    <h3 className="font-bold text-lg mb-2 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {authorDisplayName(post.author)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
