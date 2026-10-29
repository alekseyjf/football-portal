'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BlockLoadError } from '@/components/layout/BlockLoadError';
import {
  COMMENT_REPLIES_PAGE_SIZE,
  useCommentReplies,
} from '@/hooks/useComments';
import {
  focusOnAttach,
  useCommentPagesList,
} from '@/hooks/useCommentPagesList';
import type { CommentItem } from '@/lib/api/types';
import { CommentsLoadMore } from './CommentsLoadMore';
import { CommentsSkeleton } from './CommentsSkeleton';

type Props = {
  postId: string;
  rootId: string;
  /** «N відповідей» кореня — скільки карток скелетона показати, поки порція їде */
  replyCount: number;
  /** Своя нова відповідь — фокус на ній */
  focusReplyId: string | null;
  renderReply: (
    reply: CommentItem,
    focusRef: typeof focusOnAttach | undefined,
  ) => ReactNode;
};

/**
 * Розгорнута гілка: відповіді від старих до нових, порціями по 10 (D27). Поки порція їде — скелетон з її кількості
 * карток одразу після кліку: корені нижче зсуваються в межах дії користувача, а не тоді, коли відповідь API прийде.
 */
export function CommentReplies({
  postId,
  rootId,
  replyCount,
  focusReplyId,
  renderReply,
}: Props) {
  const t = useTranslations('comments');
  const repliesQuery = useCommentReplies(postId, rootId);
  const {
    comments: replies,
    loadMore,
    focusCommentId,
  } = useCommentPagesList(repliesQuery);
  const pendingCount = Math.min(
    Math.max(replyCount - replies.length, 1),
    COMMENT_REPLIES_PAGE_SIZE,
  );

  if (!repliesQuery.data) {
    return repliesQuery.isError ? (
      <BlockLoadError
        className="py-3"
        message={t('repliesLoadError')}
        retryLabel={t('retry')}
        onRetry={() => repliesQuery.refetch()}
      />
    ) : (
      <CommentsSkeleton count={pendingCount} />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {replies.map((reply) => {
          const shouldFocus =
            reply.id === focusReplyId || reply.id === focusCommentId;
          return (
            <li key={reply.id}>
              {renderReply(reply, shouldFocus ? focusOnAttach : undefined)}
            </li>
          );
        })}
      </ul>
      {repliesQuery.isFetchingNextPage ? (
        <div className="mt-3">
          <CommentsSkeleton count={pendingCount} />
        </div>
      ) : (
        repliesQuery.hasNextPage && (
          <CommentsLoadMore
            label={t('showMoreReplies')}
            isLoading={false}
            hasError={repliesQuery.isFetchNextPageError}
            onLoadMore={() => void loadMore()}
          />
        )
      )}
    </>
  );
}
