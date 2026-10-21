'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAdminPosts } from '@/hooks/useAdminPosts';
import {
  adminAuthorName,
  adminPostStatusLabel,
  adminPostTitle,
  languageShortLabel,
  type AdminPost,
} from '@/lib/api/types';
import { getPublicWebUrl } from '@/lib/publicWebUrl';

const PUBLIC_WEB_URL = getPublicWebUrl();

const STATUS_BADGE_CLASS: Record<string, string> = {
  Published: 'bg-green-600/20 text-green-400',
  Scheduled: 'bg-amber-500/20 text-amber-300',
  Draft: 'bg-gray-700 text-gray-400',
  Archived: 'bg-gray-800 text-gray-500',
};

/** Дата публікації (для запланованих — коли вийде), для чернеток — створення. */
function adminPostDateLine(post: AdminPost): string {
  const formatDateTime = (isoDate: string) =>
    new Date(isoDate).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  if (post.publishedAt && post.status === 'SCHEDULED' && !post.isLive) {
    return `Goes live ${formatDateTime(post.publishedAt)}`;
  }
  if (post.publishedAt) return `Published ${formatDateTime(post.publishedAt)}`;
  return `Created ${formatDateTime(post.createdAt)}`;
}

const PAGER_BUTTON_CLASS =
  'text-green-400 hover:text-green-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed';

/** Сторінки списку; фільтр за статусом і пошук — у списку M1.5. */
function PostsPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Posts pages" className="flex items-center justify-center gap-6 mt-6 text-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={PAGER_BUTTON_CLASS}
      >
        ← Newer
      </button>
      <span className="text-gray-400">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={PAGER_BUTTON_CLASS}
      >
        Older →
      </button>
    </nav>
  );
}

export default function PostsPage() {
  const [page, setPage] = useState(1);
  const { data: postPage, isLoading, isError, refetch } = useAdminPosts(page);
  const posts = postPage?.data;
  // Новини з останніх сторінок зникли (видалили) — на останню наявну. У рендері, а не в useEffect:
  // стан, що залежить від даних, React дозволяє виправити одразу (react.dev, «Adjusting some state when a prop changes»)
  const lastPage = Math.max(postPage?.totalPages ?? 1, 1);
  if (postPage && page > lastPage) setPage(lastPage);

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
        <div className="text-center py-16">
          <p className="text-red-400">
            Failed to load posts. Check that you are logged in as admin.
          </p>
          {/* Інакше зі сторінки, що не завантажилась, вийти можна лише перезавантаженням */}
          <div className="flex justify-center gap-6 mt-3 text-sm">
            <button type="button" onClick={() => void refetch()} className={PAGER_BUTTON_CLASS}>
              Try again
            </button>
            {page > 1 && (
              <button type="button" onClick={() => setPage(1)} className={PAGER_BUTTON_CLASS}>
                ← First page
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && postPage?.total === 0 && (
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
          {posts.map((post) => {
            const statusLabel = adminPostStatusLabel(post);
            return (
              <div
                key={post.id}
                className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{adminPostTitle(post)}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {adminPostDateLine(post)} · {adminAuthorName(post.author)} ·{' '}
                    {post.translations
                      .map((translation) => languageShortLabel(translation.languageCode))
                      .join(' / ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE_CLASS[statusLabel]}`}
                  >
                    {statusLabel}
                  </span>
                  {/* Лише для живих: чернетка / запланований на сайті — 404. URL — `{slug}-{number}` (D24) */}
                  {post.isLive && (
                    <a
                      href={`${PUBLIC_WEB_URL}/news/${encodeURIComponent(post.slug)}-${post.number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-400 hover:text-green-300 transition-colors"
                    >
                      View on site
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isError && postPage && postPage.totalPages > 1 && (
        <PostsPager page={page} totalPages={postPage.totalPages} onPageChange={setPage} />
      )}
    </main>
  );
}
