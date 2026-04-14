'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { localeToBcp47 } from '@/lib/i18n/content-lang';
import {
  CommentThreadNode,
  countCommentsInTree,
} from '@/components/comments/CommentThreadNode';

const commentSchema = z.object({
  content: z.string().min(2, 'Comment must be at least 2 characters'),
});
type CommentFormData = z.infer<typeof commentSchema>;

interface Props {
  postId: string;
}

export function CommentSection({ postId }: Props) {
  const user = useAuthStore((state) => state.user);
  const locale = useLocale();
  const dateLocale = localeToBcp47(locale);
  const t = useTranslations('comments');
  const { data: comments = [], isLoading } = useComments(postId);
  const { mutate: createComment, isPending } = useCreateComment(postId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  const totalCommentCount = countCommentsInTree(comments);

  const mapCommentApiError = (error: unknown): string | null => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'COMMENT_COOLDOWN') return t('cooldown');
    if (code === 'COMMENTS_SUSPENDED') return t('commentsSuspended');
    if (code === 'ACCOUNT_LOCKED') return t('accountLocked');
    return null;
  };

  const onSubmit = (data: CommentFormData) => {
    setSubmitError(null);
    createComment(
      { content: data.content, postId },
      {
        onSuccess: () => {
          reset();
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
    <section>
      <h2 className="text-xl font-bold mb-6">
        {t('sectionTitle')}{' '}
        <span className="text-gray-500 font-normal text-base">
          ({totalCommentCount})
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
          {submitError && (
            <p className="text-amber-400/95 text-xs mt-2">{submitError}</p>
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

      {!isLoading && comments.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          {t('none')}
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThreadNode
              key={comment.id}
              comment={comment}
              postId={postId}
              depth={0}
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
