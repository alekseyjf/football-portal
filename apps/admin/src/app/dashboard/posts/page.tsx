'use client';

import Link from 'next/link';
import { useAdminPosts } from '@/hooks/useAdminPosts';
import { adminPostTitle } from '@/lib/api/types';

const PUBLIC_WEB_URL =
  process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export default function PostsPage() {
  const { data: posts, isLoading, isError } = useAdminPosts();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📰 Posts</h1>
        <Link
          href="/dashboard/posts/create"
          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Post
        </Link>
      </div>

      {isLoading && (
        <p className="text-gray-400 text-center py-16">Loading posts…</p>
      )}

      {isError && (
        <p className="text-red-400 text-center py-16">
          Failed to load posts. Check that you are logged in as admin.
        </p>
      )}

      {!isLoading && !isError && posts && posts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-4">📭</p>
          <p>No posts yet.</p>
          <Link
            href="/dashboard/posts/create"
            className="text-green-400 hover:text-green-300 mt-2 inline-block"
          >
            Create your first post →
          </Link>
        </div>
      )}

      {!isLoading && !isError && posts && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="font-medium truncate">{adminPostTitle(post)}</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {new Date(post.createdAt).toLocaleDateString('en-GB')} ·{' '}
                  {post.author.name}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    post.published
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {post.published ? 'Published' : 'Draft'}
                </span>
                <a
                  href={`${PUBLIC_WEB_URL}/news/${encodeURIComponent(post.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-400 hover:text-green-300 transition-colors"
                >
                  View on site
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
