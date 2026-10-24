'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { NewsCardList } from '@/components/news/NewsCardList';
import { postsQueryOptions } from '@/hooks/usePosts';
import { useApiContentLang } from '@/hooks/useApiContentLang';

export function HomeFeed() {
  const contentLang = useApiContentLang();
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
        // Картка — та сама, що в стрічці `/news` (M1.6.1)
        <NewsCardList posts={posts} headingLevel={3} />
      )}
    </section>
  );
}
