'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useComments, useCreateComment, useDeleteComment } from '@/hooks/useComments';
import type { Comment } from '@/lib/api/types';
import { localeToBcp47 } from '@/lib/i18n/content-lang';

const commentSchema = z.object({
  content: z.string().min(2, 'Comment must be at least 2 characters'),
});
type CommentFormData = z.infer<typeof commentSchema>;

interface Props {
  postId: string;
}

// Форма відповіді — окремий компонент щоб не плутати стан
function ReplyForm({
  postId,
  parentId,
  onClose,
}: {
  postId: string;
  parentId: string;
  onClose: () => void;
}) {
  const t = useTranslations('comments');
  const { mutate: createComment, isPending } = useCreateComment(postId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit = (data: CommentFormData) => {
    createComment(
      { content: data.content, postId, parentId },
      { onSuccess: () => { reset(); onClose(); } },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 ml-10">
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

// Один коментар з replies
function CommentItem({
  comment,
  postId,
  userId,
  userRole,
  dateLocale,
}: {
  comment: Comment;
  postId: string;
  userId?: string;
  userRole?: string;
  dateLocale: string;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const t = useTranslations('comments');
  const { mutate: deleteComment } = useDeleteComment(postId);

  const canDelete = userId && (userId === comment.author.id || userRole === 'ADMIN');

  return (
    <div>
      <div className={`bg-gray-900 rounded-xl px-5 py-4 
        ${comment.pinnedAt ? 'border border-green-500/30' : ''}`}>

        {comment.pinnedAt && (
          <p className="text-xs text-green-400 mb-2">📌 {t('pinned')}</p>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center 
              justify-center text-xs font-bold flex-shrink-0">
              {comment.author.name[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{comment.author.name}</span>
            <span className="text-xs text-gray-500">
              {new Date(comment.createdAt).toLocaleDateString(dateLocale)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userId && (
              <button
                type="button"
                onClick={() => setShowReplyForm((value) => !value)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {t('reply')}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => deleteComment(comment.id)}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors"
              >
                {t('delete')}
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed">{comment.content}</p>
      </div>

      {/* Reply форма */}
      {showReplyForm && (
        <ReplyForm
          postId={postId}
          parentId={comment.id}
          onClose={() => setShowReplyForm(false)}
        />
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="bg-gray-900/70 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-green-700 flex items-center 
                  justify-center text-xs font-bold flex-shrink-0">
                  {reply.author.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium">{reply.author.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(reply.createdAt).toLocaleDateString(dateLocale)}
                </span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({ postId }: Props) {
  const user = useAuthStore((state) => state.user);
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('comments');
  const { data: comments = [], isLoading } = useComments(postId);
  const { mutate: createComment, isPending } = useCreateComment(postId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit = (data: CommentFormData) => {
    createComment(
      { content: data.content, postId },
      { onSuccess: () => reset() },
    );
  };

  return (
    <section>
      <h2 className="text-xl font-bold mb-6">
        {t('sectionTitle')}{' '}
        <span className="text-gray-500 font-normal text-base">
          ({comments.length})
        </span>
      </h2>

      {user ? (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-8">
          <textarea
            {...register('content')}
            rows={3}
            placeholder={t('commentPlaceholder')}
            className={`w-full bg-gray-900 rounded-xl px-4 py-3 text-white 
              placeholder-gray-500 outline-none border transition-colors resize-none
              ${errors.content ? 'border-red-500' : 'border-gray-700 focus:border-green-500'}`}
          />
          {errors.content && (
            <p className="text-red-400 text-xs mt-1">{errors.content.message}</p>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 
                disabled:cursor-not-allowed px-5 py-2 rounded-lg text-sm 
                font-medium transition-colors"
            >
              {isPending ? t('posting') : t('postComment')}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-900 rounded-xl px-5 py-4 mb-8 text-center">
          <p className="text-gray-400 text-sm">
            {t.rich('signInCta', {
              auth: (chunks) => (
                <Link href="/auth/login" className="text-green-400 hover:text-green-300">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="bg-gray-900 rounded-xl px-5 py-4 animate-pulse">
              <div className="flex gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-700" />
                <div className="h-4 bg-gray-700 rounded w-32" />
              </div>
              <div className="h-3 bg-gray-700 rounded w-full mb-1" />
              <div className="h-3 bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Список коментарів */}
      {!isLoading && comments.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          {t('none')}
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              userId={user?.id}
              userRole={user?.role}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </section>
  );
}
