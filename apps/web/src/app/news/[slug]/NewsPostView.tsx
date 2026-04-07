'use client';

import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_CONTENT_LANG,
  getTranslation,
} from '@/lib/api/types';
import { postDetailQueryOptions } from '@/hooks/usePostDetail';
import { CommentSection } from './CommentSection';

export function NewsPostView({ slug }: { slug: string }) {
  const { data: post, isLoading, isError, error } = useQuery(
    postDetailQueryOptions(slug, DEFAULT_CONTENT_LANG),
  );

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-400">Loading article…</p>
      </main>
    );
  }

  if (isError || !post) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-400">
          {error instanceof Error ? error.message : 'Failed to load post'}
        </p>
      </main>
    );
  }

  const t = getTranslation(post, DEFAULT_CONTENT_LANG);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <article>
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={t.title}
            className="w-full h-64 object-cover rounded-2xl mb-6"
          />
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3">{t.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>By {post.author.name}</span>
            <span>·</span>
            <time>
              {new Date(post.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
        </div>

        <p className="text-gray-300 text-lg leading-relaxed mb-6 border-l-4 border-green-500 pl-4 italic">
          {t.excerpt}
        </p>

        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {t.content ?? ''}
          </p>
        </div>
      </article>

      <hr className="border-gray-800 my-10" />

      <CommentSection postId={post.id} />
    </main>
  );
}
