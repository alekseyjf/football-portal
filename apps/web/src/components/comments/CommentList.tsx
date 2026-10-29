'use client';

import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BlockLoadError } from '@/components/layout/BlockLoadError';
import {
  focusOnAttach,
  useCommentPagesList,
} from '@/hooks/useCommentPagesList';
import type { CommentRootsPage, UserAccount } from '@/lib/api/types';
import type { CommentPages } from '@/lib/comments/comment-pages';
import { CommentBranch } from './CommentBranch';
import { CommentsLoadMore } from './CommentsLoadMore';
import { CommentsSkeleton } from './CommentsSkeleton';

/** Скелетон до першої порції: стільки карток, скільки зазвичай видно на екрані. */
const SKELETON_COMMENTS = 3;

type Props = {
  postId: string;
  rootsQuery: UseInfiniteQueryResult<CommentPages<CommentRootsPage>>;
  viewer: UserAccount | null;
};

/** Корені — нові першими, порціями по 20 («Показати ще», D27). До першої порції — скелетон. */
export function CommentList({ postId, rootsQuery, viewer }: Props) {
  const t = useTranslations('comments');
  const { comments: roots, loadMore, focusCommentId } =
    useCommentPagesList(rootsQuery);

  if (!rootsQuery.data) {
    return rootsQuery.isError ? (
      <BlockLoadError
        message={t('loadError')}
        retryLabel={t('retry')}
        onRetry={() => rootsQuery.refetch()}
      />
    ) : (
      <CommentsSkeleton count={SKELETON_COMMENTS} />
    );
  }

  if (roots.length === 0) {
    return <p className="py-8 text-center text-gray-500">{t('none')}</p>;
  }

  return (
    <>
      <ul className="space-y-5">
        {roots.map((root) => (
          <CommentBranch
            key={root.id}
            postId={postId}
            root={root}
            viewer={viewer}
            focusRef={root.id === focusCommentId ? focusOnAttach : undefined}
          />
        ))}
      </ul>
      {rootsQuery.hasNextPage && (
        <CommentsLoadMore
          label={t('showMore')}
          isLoading={rootsQuery.isFetchingNextPage}
          hasError={rootsQuery.isFetchNextPageError}
          onLoadMore={() => void loadMore()}
        />
      )}
    </>
  );
}
