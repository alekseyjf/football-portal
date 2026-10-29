'use client';

import { useTranslations } from 'next-intl';
import type { CommentItem } from '@/lib/api/types';
import { replyAddresseeName } from '@/lib/comments/reply-addressee';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { useCommentEdit } from '@/hooks/useCommentEdit';
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat';
import { CommentComposer } from './CommentComposer';
import { CommentLikeBar } from './CommentLikeBar';

const COMMENT_DATE_FORMAT = {
  dateStyle: 'medium',
  timeStyle: 'short',
} as const;

type Props = {
  postId: string;
  /** Живий коментар (заглушка — `DeletedCommentStub`) */
  comment: CommentItem;
  canDelete: boolean;
  /** Свій, і 15 хв за годинником читача ще не минули (остаточно вирішує API) */
  canEdit: boolean;
  /** `null` — гість: «Відповісти» не показуємо */
  onReply: (() => void) | null;
  onDelete: () => void;
  /** Фокус на картці (перший новий після «Показати ще», своя нова відповідь) */
  focusRef?: (element: HTMLElement | null) => void;
};

/**
 * Коментар: автор, час і «(змінено)», «@Ім'я» адресата перед текстом (D27), лайки з порції, «Відповісти»,
 * «Редагувати» — форма на місці тексту (M1.7.4), «Видалити».
 */
export function CommentCard({
  postId,
  comment,
  canDelete,
  canEdit,
  onReply,
  onDelete,
  focusRef,
}: Props) {
  const t = useTranslations('comments');
  const tUsers = useTranslations('users');
  const authorDisplayName = useAuthorDisplayName();
  const formatDate = useDateTimeFormat();
  // Деструктуризація, не `edit.…`: ref-колбек з об'єкта React Compiler вважає ref-ом усього об'єкта
  const { isEditing, openEditor, cancelEditor, saveEdit, attachEditButton } =
    useCommentEdit(postId, comment);

  const authorName = comment.author
    ? authorDisplayName(comment.author)
    : tUsers('deletedUser');
  const isAuthorDeleted = !comment.author || comment.author.isDeleted;
  const addresseeName = replyAddresseeName(
    comment.replyTo,
    tUsers('deletedUser'),
  );

  return (
    <article
      ref={focusRef}
      tabIndex={-1}
      className="rounded-xl bg-gray-900 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-green-500 sm:px-5 sm:py-4"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
              ${isAuthorDeleted ? 'bg-gray-700 text-gray-400' : 'bg-green-600'}`}
          >
            {isAuthorDeleted ? '?' : authorName.charAt(0).toUpperCase() || '?'}
          </span>
          {/* Вузько (320 px, довга дата українською) — дата під ім'ям, а не замість нього */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span
              className={`max-w-full truncate text-sm font-medium ${isAuthorDeleted ? 'italic text-gray-500' : ''}`}
            >
              {authorName}
            </span>
            <time
              dateTime={comment.createdAt}
              className="text-xs text-gray-500"
            >
              {formatDate(comment.createdAt, COMMENT_DATE_FORMAT)}
            </time>
            {/* Як на YouTube: позначка біля дати, час зміни — у підказці */}
            {comment.editedAt && (
              <time
                dateTime={comment.editedAt}
                title={t('editedAt', {
                  date: formatDate(comment.editedAt, COMMENT_DATE_FORMAT),
                })}
                className="text-xs text-gray-500"
              >
                {t('edited')}
              </time>
            )}
          </div>
        </div>

        {canDelete && !isEditing && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded px-1 text-xs text-gray-500 transition-colors hover:text-red-400"
          >
            {t('delete')}
          </button>
        )}
      </header>

      {isEditing ? (
        <CommentComposer
          initialContent={comment.content ?? ''}
          // Адресат — частина відповіді, не тексту: правка його не змінює, тож чип без «×»
          addressee={addresseeName ? { name: addresseeName } : null}
          autoFocus
          placeholder={t('editPlaceholder')}
          submitLabel={t('save')}
          onCancel={cancelEditor}
          onSubmit={saveEdit}
        />
      ) : (
        <>
          <p className="whitespace-pre-line wrap-break-word text-sm leading-relaxed text-gray-300">
            {addresseeName && (
              <span className="font-medium text-sky-400">
                @{addresseeName}{' '}
              </span>
            )}
            {comment.content}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <CommentLikeBar postId={postId} comment={comment} />
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="rounded px-1 text-xs uppercase tracking-wide text-gray-400 transition-colors hover:text-white"
              >
                {t('reply')}
              </button>
            )}
            {canEdit && (
              <button
                ref={attachEditButton}
                type="button"
                onClick={openEditor}
                className="rounded px-1 text-xs uppercase tracking-wide text-gray-400 transition-colors hover:text-white"
              >
                {t('edit')}
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
