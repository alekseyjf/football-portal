'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useCommentRoots, useCreateComment } from '@/hooks/useComments';
import { useNearViewport } from '@/hooks/useNearViewport';
import { commentCountOfPages } from '@/lib/comments/comment-pages';
import { CommentComposer } from '@/components/comments/CommentComposer';
import { CommentList } from '@/components/comments/CommentList';

/** Коментарі вантажимо, коли до них лишилось менше екрана прокрутки, — не в SSR (D27). */
const COMMENTS_PRELOAD_MARGIN = '0px 0px 600px 0px';

/**
 * Висота поля нового коментаря (3 рядки й кнопка, 137 px): місце, поки сесія відновлюється, і запрошення гостю —
 * не нижчі, тож коментарі під ними не стрибають, коли стане ясно, хто читає.
 */
const COMPOSER_SLOT_CLASS = 'mb-8 min-h-[8.5625rem]';

interface Props {
  postId: string;
}

/** Коментарі новини як на YouTube (D27): «N коментарів», поле нового коментаря, корені порціями. */
export function CommentSection({ postId }: Props) {
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const t = useTranslations('comments');
  const { ref, isNearViewport } = useNearViewport<HTMLElement>(
    COMMENTS_PRELOAD_MARGIN,
  );
  const rootsQuery = useCommentRoots(postId, isNearViewport);
  const { mutateAsync: createComment } = useCreateComment(postId);
  const commentCount = commentCountOfPages(rootsQuery.data?.pages ?? []);

  return (
    <section ref={ref} aria-labelledby="comments-title">
      <h2 id="comments-title" className="mb-6 text-xl font-bold">
        {commentCount === null
          ? t('sectionTitle')
          : t('commentCount', { count: commentCount })}
      </h2>

      {isAuthLoading ? (
        // Сесія ще відновлюється (`GET /auth/me`) — не блимати запрошенням «увійдіть»
        <div className={COMPOSER_SLOT_CLASS} aria-hidden />
      ) : user ? (
        <div className={COMPOSER_SLOT_CLASS}>
          <CommentComposer
            placeholder={t('commentPlaceholder')}
            submitLabel={t('postComment')}
            onSubmit={(content) => createComment({ content, postId })}
          />
        </div>
      ) : (
        <div
          className={`${COMPOSER_SLOT_CLASS} flex items-center justify-center rounded-xl bg-gray-900 px-5 py-4 text-center`}
        >
          <p className="text-sm text-gray-400">
            {t.rich('signInCta', {
              auth: (chunks) => (
                <Link
                  href="/auth/login"
                  className="text-green-400 hover:text-green-300"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      )}

      <CommentList postId={postId} rootsQuery={rootsQuery} viewer={user} />
    </section>
  );
}
