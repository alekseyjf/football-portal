'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { CommentItem, UserAccount } from '@/lib/api/types';
import { useAuthorDisplayName } from '@/hooks/useAuthorDisplayName';
import { useCommentBranch } from '@/hooks/useCommentBranch';
import type { focusOnAttach } from '@/hooks/useCommentPagesList';
import { CommentCard } from './CommentCard';
import { CommentComposer, type ComposerAddressee } from './CommentComposer';
import { CommentReplies } from './CommentReplies';
import { DeletedCommentStub } from './DeletedCommentStub';

type Props = {
  postId: string;
  root: CommentItem;
  viewer: UserAccount | null;
  focusRef?: typeof focusOnAttach;
};

/** Корінь і під ним «▼ N відповідей» — один рівень, як на YouTube (D27). */
export function CommentBranch({ postId, root, viewer, focusRef }: Props) {
  const t = useTranslations('comments');
  const tUsers = useTranslations('users');
  const authorDisplayName = useAuthorDisplayName();
  const branch = useCommentBranch(postId, root);
  const repliesId = useId();

  const addressee: ComposerAddressee | null =
    branch.composer && branch.composer.parent.id !== root.id
      ? {
          name: branch.composer.parent.author
            ? authorDisplayName(branch.composer.parent.author)
            : tUsers('deletedUser'),
          onRemove: branch.removeAddressee ?? undefined,
        }
      : null;

  const composerAfter = (commentId: string) =>
    branch.composer?.afterCommentId === commentId && (
      // Під коренем — з відступом відповідей; під відповіддю — вже в ньому
      <div className={commentId === root.id ? 'ml-6 mt-3 sm:ml-12' : 'mt-3'}>
        <CommentComposer
          rows={2}
          autoFocus
          placeholder={t('replyPlaceholder')}
          submitLabel={t('postReply')}
          addressee={addressee}
          onCancel={branch.cancelComposer}
          onSubmit={branch.postReply}
        />
      </div>
    );

  const card = (comment: CommentItem, cardFocusRef?: typeof focusOnAttach) => (
    <>
      <CommentCard
        postId={postId}
        comment={comment}
        canDelete={
          viewer !== null &&
          (viewer.id === comment.author?.id || viewer.role === 'ADMIN')
        }
        onReply={viewer ? () => branch.openComposer(comment) : null}
        onDelete={() => branch.deleteWithConfirm(comment)}
        focusRef={cardFocusRef}
      />
      {composerAfter(comment.id)}
    </>
  );

  return (
    <li>
      {root.isDeleted ? <DeletedCommentStub focusRef={focusRef} /> : card(root, focusRef)}

      {root.replyCount > 0 && (
        <div className="ml-6 sm:ml-12">
          <button
            type="button"
            aria-expanded={branch.isExpanded}
            aria-controls={repliesId}
            onClick={branch.toggleReplies}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-sky-400 transition-colors hover:bg-gray-800 hover:text-sky-300"
          >
            <span aria-hidden className="text-[0.7em]">
              {branch.isExpanded ? '▲' : '▼'}
            </span>
            {branch.isExpanded
              ? t('hideReplies')
              : t('replyCount', { count: root.replyCount })}
          </button>
          {branch.isExpanded && (
            <div id={repliesId} className="mt-2">
              <CommentReplies
                postId={postId}
                rootId={root.id}
                replyCount={root.replyCount}
                focusReplyId={branch.focusReplyId}
                renderReply={card}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
