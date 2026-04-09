'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { getTranslation } from '@/lib/api/types';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import { postsQueryOptions } from '@/hooks/usePosts';
import { useApiContentLang } from '@/hooks/useApiContentLang';

export function HomeFeed() {
  const contentLang = useApiContentLang();
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('feed');

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
            const translation = getTranslation(post, contentLang);
            return (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="block bg-gray-900 rounded-xl overflow-hidden hover:bg-gray-800 transition-colors"
              >
                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt={translation.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-5">
                  <p className="text-xs text-green-400 mb-2">
                    {new Date(post.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                  <h3 className="font-bold text-lg mb-2 line-clamp-2">
                    {translation.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">
                    {translation.excerpt}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    {post.author.name}
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
