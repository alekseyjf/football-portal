'use client';

import { AdminLink } from '@/components/AdminLink';
import { useAdminPost } from '@/hooks/useAdminPost';
import { useLastPostListHref } from '@/hooks/useLastPostListHref';
import { isApiError } from '@/lib/api/http';
import { EditPostForm } from './EditPostForm';

const LINK_CLASS = 'text-green-400 transition-colors hover:text-green-300';

/** Новина з API → форма редагування; немає (видалена, хибна адреса) — сторінка «не знайдено» з дорогою назад. */
export function EditPostView({ postId }: { postId: string }) {
  const { data: post, isPending, error, refetch } = useAdminPost(postId);
  const listHref = useLastPostListHref();

  // Дані є — форма, навіть коли фоновий refetch упав: інакше збій мережі прибрав би незбережений текст.
  // `key` — інша новина (перехід між сторінками редагування) починає з власних значень
  if (post) return <EditPostForm key={post.id} post={post} />;
  if (isPending) return <p className="py-16 text-center text-gray-400">Loading post…</p>;

  if (isApiError(error) && error.status === 404) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="mt-2 text-gray-400">It was deleted, or the address is wrong.</p>
        <AdminLink href={listHref} className={`mt-4 inline-block ${LINK_CLASS}`}>
          ← All posts
        </AdminLink>
      </div>
    );
  }
  return (
    <div className="py-16 text-center">
      <p className="text-red-400">Failed to load the post. Check that you are logged in as admin.</p>
      <button type="button" onClick={() => void refetch()} className={`mt-3 text-sm ${LINK_CLASS}`}>
        Try again
      </button>
    </div>
  );
}
