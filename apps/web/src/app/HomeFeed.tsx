'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_CONTENT_LANG,
  getTranslation,
} from '@/lib/api/types';
import { postsQueryOptions } from '@/hooks/usePosts';

export function HomeFeed() {
  const { data: postsData, isLoading, isError } = useQuery(
    postsQueryOptions(1, 6, DEFAULT_CONTENT_LANG),
  );

  const posts = postsData?.data ?? [];

  if (isLoading) {
    return (
      <p className="text-gray-400 text-center py-12">Loading news…</p>
    );
  }

  if (isError) {
    return (
      <p className="text-gray-400 text-center py-12">
        Could not load posts. Please try again later.
      </p>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">Latest News</h2>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-center py-12">
          No posts yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const t = getTranslation(post, DEFAULT_CONTENT_LANG);
            return (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="block bg-gray-900 rounded-xl overflow-hidden hover:bg-gray-800 transition-colors"
              >
                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt={t.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-5">
                  <p className="text-xs text-green-400 mb-2">
                    {new Date(post.createdAt).toLocaleDateString('en-GB')}
                  </p>
                  <h3 className="font-bold text-lg mb-2 line-clamp-2">
                    {t.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">
                    {t.excerpt}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    By {post.author.name}
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
