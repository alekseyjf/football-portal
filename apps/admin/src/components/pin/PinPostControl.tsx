'use client';

import { DIALOG_BUTTON_CLASS, DIALOG_CLASS } from '@/components/dialogStyles';
import { PIN_BUTTON_LABEL, usePinPostAction } from '@/hooks/usePinPostAction';
import { adminPostTitle, type AdminPost } from '@/lib/api/types';
import { PinnedBadge } from './PinnedBadge';

const DIALOG_TITLE_ID_PREFIX = 'pin-dialog-title-';

interface PinPostControlProps {
  post: Pick<AdminPost, 'id' | 'isLive' | 'pinnedAt' | 'translations'>;
  /** Назва новини в підписі кнопки для екранного диктора — у списку, де кнопок багато */
  hasTitleInLabel?: boolean;
  buttonClassName: string;
}

/**
 * Pin / Unpin головної новини сайту (D56) — у рядку списку й на сторінці редагування. Заміна закріпленої — лише
 * після `<dialog>`: фокус при відкритті — на Cancel (першою стоїть безпечна дія), Esc закриває, після закриття
 * фокус — знову на кнопці. Не на сайті й не закріплена — кнопки немає.
 */
export function PinPostControl({ post, hasTitleInLabel = false, buttonClassName }: PinPostControlProps) {
  const {
    dialogRef,
    triggerRef,
    replacement,
    errorMessage,
    isPending,
    requestPin,
    confirmReplacement,
    unpin,
    closeDialog,
    handleDialogClose,
  } = usePinPostAction(post.id);
  const isPinned = post.pinnedAt !== null;
  if (!isPinned && !post.isLive) return null;

  const title = adminPostTitle(post);
  const titleLabel = hasTitleInLabel ? <span className="sr-only"> “{title}”</span> : null;
  const dialogTitleId = `${DIALOG_TITLE_ID_PREFIX}${post.id}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={isPinned ? unpin : () => void requestPin()}
        disabled={isPending}
        className={buttonClassName}
      >
        {isPinned ? 'Unpin' : PIN_BUTTON_LABEL}
        {titleLabel}
      </button>
      {errorMessage && !replacement && (
        <p role="alert" className="w-full text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={handleDialogClose}
        className={DIALOG_CLASS}
      >
        {replacement && (
          <>
            <h2 id={dialogTitleId} className="text-lg font-semibold">
              Replace the home page lead?
            </h2>
            {replacement.hasChanged && (
              <p className="mt-2 text-sm text-amber-300">The home page lead changed while you were deciding.</p>
            )}
            <p className="mt-2 text-sm text-gray-300">
              Replaces the current home lead: “{adminPostTitle(replacement.current)}”.
            </p>
            <p className="mt-2">
              <PinnedBadge post={replacement.current} />
            </p>
            <p className="mt-2 text-sm text-gray-300">“{title}” becomes the lead on the home page.</p>
            {errorMessage && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              {/* Першою — безпечна дія: на неї стає фокус, щойно діалог відкрився */}
              <button
                type="button"
                onClick={closeDialog}
                className={`bg-gray-800 hover:bg-gray-700 ${DIALOG_BUTTON_CLASS}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReplacement()}
                disabled={isPending}
                className={`bg-green-600 font-semibold hover:bg-green-500 ${DIALOG_BUTTON_CLASS}`}
              >
                {isPending ? 'Pinning…' : 'Replace the lead'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
