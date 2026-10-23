'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useDeletePost } from '@/hooks/useDeletePost';
import { lastPostListHref } from '@/hooks/useLastPostListHref';
import { useLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { isApiError } from '@/lib/api/http';
import { adminPostTitle, type AdminPostDetail } from '@/lib/api/types';

const SECTION_TITLE_ID = 'delete-post-heading';
const DIALOG_TITLE_ID = 'delete-post-dialog-title';
const BUTTON_CLASS = 'rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60';

function deleteErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === 'POST_NOT_FOUND') return 'This post was already deleted.';
  return 'Failed to delete the post — try again.';
}

/**
 * Видалення новини — soft delete (рядок лишається в БД), але кнопки «відновити» в адмінці немає, тож лише
 * після підтвердження в діалозі. Нативний `<dialog>` (`showModal`): фокус усередині, Esc закриває.
 */
export function DeletePostSection({ post }: { post: AdminPostDetail }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { mutate: deletePost, isPending, error, reset } = useDeletePost();
  const leaveGuard = useLeaveGuard();

  const openDialog = () => {
    reset();
    dialogRef.current?.showModal();
  };
  // Видалення вже підтверджено діалогом: незбережені правки видаленої новини сторож не захищає (D50)
  const confirmDelete = () =>
    deletePost(post.id, {
      onSuccess: () => {
        leaveGuard.allowLeave();
        router.push(lastPostListHref());
      },
    });

  return (
    <section aria-labelledby={SECTION_TITLE_ID} className="mt-10 rounded-xl border border-red-500/30 p-4">
      <h2 id={SECTION_TITLE_ID} className="text-sm font-semibold text-red-300">
        Delete post
      </h2>
      <p className="mt-1 text-sm text-gray-400">
        The post disappears from the site and from the posts list. The admin has no button to restore it.
      </p>
      <button
        type="button"
        onClick={openDialog}
        className={`mt-3 border border-red-500/60 text-red-300 hover:bg-red-500/10 ${BUTTON_CLASS}`}
      >
        Delete post…
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={DIALOG_TITLE_ID}
        className="m-auto w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 text-white backdrop:bg-black/70"
      >
        <h2 id={DIALOG_TITLE_ID} className="text-lg font-semibold">
          Delete this post?
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          “{adminPostTitle(post)}” disappears from the site and from the posts list; it can’t be restored from the
          admin.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {deleteErrorMessage(error)}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          {/* Першою — безпечна дія: на неї стає фокус, щойно діалог відкрився */}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={`bg-gray-800 hover:bg-gray-700 ${BUTTON_CLASS}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={isPending}
            className={`bg-red-600 font-semibold hover:bg-red-500 ${BUTTON_CLASS}`}
          >
            {isPending ? 'Deleting…' : 'Delete post'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
