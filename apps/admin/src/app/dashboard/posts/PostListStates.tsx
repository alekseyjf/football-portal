import { AdminLink } from '@/components/AdminLink';
import { POST_LIST_PATH, postListHref, type PostListParams } from '@/lib/postListParams';
import { PostListLink } from './PostListLink';
import { POST_STATUS_FILTER_LABELS } from './PostStatusFilter';

const LINK_CLASS = 'text-green-400 transition-colors hover:text-green-300';

export function PostListLoading() {
  return (
    <p role="status" className="py-16 text-center text-gray-400">
      Loading posts…
    </p>
  );
}

export function PostListError({ params, onRetry }: { params: PostListParams; onRetry: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="text-red-400">Failed to load posts. Check that you are logged in as admin.</p>
      <div className="mt-3 flex justify-center gap-6 text-sm">
        <button type="button" onClick={onRetry} className={LINK_CLASS}>
          Try again
        </button>
        {params.page > 1 && (
          <PostListLink href={postListHref({ ...params, page: 1 })} className={LINK_CLASS}>
            ← First page
          </PostListLink>
        )}
      </div>
    </div>
  );
}

/** Новин немає зовсім — створити першу; немає за фільтром чи пошуком — показати всі. */
export function NoPosts({ params }: { params: PostListParams }) {
  if (params.status === null && params.search === '') {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="mb-4 text-4xl">📭</p>
        <p>No posts yet.</p>
        <AdminLink href="/dashboard/posts/create" className={`mt-2 inline-block ${LINK_CLASS}`}>
          Create your first post →
        </AdminLink>
      </div>
    );
  }
  return (
    <div role="status" className="py-16 text-center text-gray-400">
      <p>
        No posts found
        {params.search && ` for “${params.search}”`}
        {params.status && ` in ${POST_STATUS_FILTER_LABELS[params.status]}`}.
      </p>
      <PostListLink href={POST_LIST_PATH} className={`mt-2 inline-block ${LINK_CLASS}`}>
        Show all posts
      </PostListLink>
    </div>
  );
}

/** Сторінки вже немає (новини видалили, старе посилання) — шлях на останню, а не тихий перехід. */
export function PageOutOfRange({ params, totalPages }: { params: PostListParams; totalPages: number }) {
  return (
    <div className="py-16 text-center text-gray-400">
      <p>
        Page {params.page} is empty — the list has {totalPages} {totalPages === 1 ? 'page' : 'pages'}.
      </p>
      <PostListLink href={postListHref({ ...params, page: totalPages })} className={`mt-2 inline-block ${LINK_CLASS}`}>
        ← Go to page {totalPages}
      </PostListLink>
    </div>
  );
}
