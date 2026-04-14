'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import type { Comment } from '@/lib/api/types';
import { useCreateComment, useDeleteComment } from '@/hooks/useComments';
import { LikeBar } from '@/components/features/LikeBar';

const replySchema = z.object({
  content: z.string().min(2, 'Comment must be at least 2 characters'),
});
type ReplyFormData = z.infer<typeof replySchema>;

function ReplyForm({
  postId,
  parentId,
  onClose,
  indentClassName,
}: {
  postId: string;
  parentId: string;
  onClose: () => void;
  indentClassName: string;
}) {
  const t = useTranslations('comments');
  const { mutate: createComment, isPending } = useCreateComment(postId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
  });

  const mapCommentApiError = (error: unknown): string | null => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'COMMENT_COOLDOWN') return t('cooldown');
    if (code === 'COMMENTS_SUSPENDED') return t('commentsSuspended');
    if (code === 'ACCOUNT_LOCKED') return t('accountLocked');
    return null;
  };

  const onSubmit = (data: ReplyFormData) => {
    setSubmitError(null);
    createComment(
      { content: data.content, postId, parentId },
      {
        onSuccess: () => {
          reset();
          onClose();
          setSubmitError(null);
        },
        onError: (error) => {
          const mapped = mapCommentApiError(error);
          if (mapped) setSubmitError(mapped);
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`mt-3 ${indentClassName}`}
    >
      <textarea
        {...register('content')}
        rows={2}
        placeholder={t('replyPlaceholder')}
        className={`w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white 
          placeholder-gray-500 outline-none border resize-none transition-colors
          ${errors.content ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`}
      />
      {errors.content && (
        <p className="text-red-400 text-xs mt-1">{errors.content.message}</p>
      )}
      {submitError && (
        <p className="text-amber-400/95 text-xs mt-2">{submitError}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 
            px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          {isPending ? t('posting') : t('postReply')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg 
            text-xs transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

type Props = {
  comment: Comment;
  postId: string;
  depth: number;
  userId?: string;
  userRole?: string;
  dateLocale: string;
};

export function CommentThreadNode({
  comment,
  postId,
  depth,
  userId,
  userRole,
  dateLocale,
}: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [repliesCollapsed, setRepliesCollapsed] = useState(false);
  const t = useTranslations('comments');
  const { mutate: deleteComment } = useDeleteComment(postId);

  const canDelete = userId && (userId === comment.author.id || userRole === 'ADMIN');
  const replies = comment.replies ?? [];
  const hasReplies = replies.length > 0;
  const replyIndent = depth > 0 ? 'pl-1' : 'pl-2';

  return (
    <div className={depth > 0 ? 'flex gap-3 mt-2' : ''}>
      {depth > 0 && (
        <div
          className="w-px shrink-0 bg-gray-600/70 self-stretch min-h-[3rem] rounded-full"
          aria-hidden
        />
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`bg-gray-900 rounded-xl px-4 py-3 sm:px-5 sm:py-4
            ${comment.pinnedAt ? 'border border-green-500/30' : ''}`}
        >
          {comment.pinnedAt && (
            <p className="text-xs text-green-400 mb-2">📌 {t('pinned')}</p>
          )}

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-full bg-green-600 flex items-center 
                  justify-center text-xs font-bold shrink-0"
              >
                {comment.author.name[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">{comment.author.name}</span>
              <span className="text-xs text-gray-500 shrink-0">
                {new Date(comment.createdAt).toLocaleDateString(dateLocale)}
              </span>
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={() => deleteComment(comment.id)}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
              >
                {t('delete')}
              </button>
            )}
          </div>

          <p className="text-gray-300 text-sm leading-relaxed">{comment.content}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <LikeBar compact targetType="comment" targetId={comment.id} />
            {userId && (
              <button
                type="button"
                onClick={() => setShowReplyForm((value) => !value)}
                className="text-xs text-gray-400 hover:text-white transition-colors uppercase tracking-wide"
              >
                {t('reply')}
              </button>
            )}
          </div>
        </div>

        {showReplyForm && (
          <ReplyForm
            postId={postId}
            parentId={comment.id}
            onClose={() => setShowReplyForm(false)}
            indentClassName={replyIndent}
          />
        )}

        {hasReplies && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setRepliesCollapsed((value) => !value)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
            >
              {repliesCollapsed
                ? t('showReplies', { count: String(replies.length) })
                : t('hideReplies')}
            </button>
            {!repliesCollapsed && (
              <div className="space-y-0">
                {replies.map((reply) => (
                  <CommentThreadNode
                    key={reply.id}
                    comment={reply}
                    postId={postId}
                    depth={depth + 1}
                    userId={userId}
                    userRole={userRole}
                    dateLocale={dateLocale}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function countCommentsInTree(nodes: Comment[]): number {
  return nodes.reduce(
    (total, node) =>
      total + 1 + countCommentsInTree(node.replies ?? []),
    0,
  );
}
