'use client';

import type { RefObject } from 'react';
import { DIALOG_BUTTON_CLASS, DIALOG_CLASS } from '@/components/dialogStyles';
import { useDeleteTag } from '@/hooks/useDeleteTag';
import { isApiError } from '@/lib/api/http';
import type { AdminTag } from '@/lib/api/types';
import { postCountLabel, tagTitle } from '@/lib/tagNames';

const DIALOG_TITLE_ID = 'delete-tag-dialog-title';

function deleteErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === 'TAG_NOT_FOUND') return 'This tag was already deleted.';
  return 'Failed to delete the tag — try again.';
}

interface DeleteTagDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** Тег з останнього списку: кількість новин перечитується, поки діалог відкрито; `null` — закрито */
  tag: AdminTag | null;
  /** `key` вмісту — свій для кожного відкриття (`useModalDialog`): перечитаний список вміст не перемонтовує */
  openingKey: number;
  onClose: () => void;
  onCancel: () => void;
  onDeleted: (tag: AdminTag) => void;
}

/**
 * Видалення тегу (D45): API видаляє одразу, назавжди й з усіх новин, тож питає інтерфейс — скільки новин втратять тег,
 * і чернетки теж. Нативний `<dialog>`: фокус — на Cancel (безпечна дія першою), Esc закриває.
 */
export function DeleteTagDialog({ dialogRef, tag, openingKey, onClose, onCancel, onDeleted }: DeleteTagDialogProps) {
  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby={DIALOG_TITLE_ID} className={DIALOG_CLASS}>
      {/* `key` — помилка минулої спроби не переходить на наступне відкриття, і того самого тегу */}
      {tag && <DeleteTagConfirm key={openingKey} tag={tag} onCancel={onCancel} onDeleted={onDeleted} />}
    </dialog>
  );
}

interface DeleteTagConfirmProps {
  tag: AdminTag;
  onCancel: () => void;
  onDeleted: (tag: AdminTag) => void;
}

function DeleteTagConfirm({ tag, onCancel, onDeleted }: DeleteTagConfirmProps) {
  const { mutate: deleteTag, isPending, error } = useDeleteTag();
  return (
    <>
      <h2 id={DIALOG_TITLE_ID} className="text-lg font-semibold">
        Delete the tag “{tagTitle(tag)}”?
      </h2>
      <p className="mt-2 text-sm text-gray-300">
        {tag.postCount === 0
          ? 'No posts have this tag.'
          : `It is on ${postCountLabel(tag.postCount)}, drafts included — it will be removed from all of them.`}{' '}
        The tag is deleted for good: this can’t be undone.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {deleteErrorMessage(error)}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        {/* Першою — безпечна дія: на неї стає фокус, щойно діалог відкрився */}
        <button type="button" onClick={onCancel} className={`bg-gray-800 hover:bg-gray-700 ${DIALOG_BUTTON_CLASS}`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => deleteTag(tag.id, { onSuccess: () => onDeleted(tag) })}
          disabled={isPending}
          className={`bg-red-600 font-semibold hover:bg-red-500 ${DIALOG_BUTTON_CLASS}`}
        >
          {isPending ? 'Deleting…' : 'Delete tag'}
        </button>
      </div>
    </>
  );
}
