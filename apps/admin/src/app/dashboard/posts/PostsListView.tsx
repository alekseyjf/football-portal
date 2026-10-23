'use client';

import { useAdminPosts } from '@/hooks/useAdminPosts';
import { usePostListUrl } from '@/hooks/usePostListUrl';
import { editorTimeZone } from '@/lib/editorDateTime';
import type { PostListParams } from '@/lib/postListParams';
import { NoPosts, PageOutOfRange, PostListError, PostListLoading } from './PostListStates';
import { PostListRow } from './PostListRow';
import { PostSearchField } from './PostSearchField';
import { PostStatusFilter } from './PostStatusFilter';
import { PostsPager } from './PostsPager';

/** Список новин: фільтр за статусом і пошук над ним, стан — в адресі (D50). */
export function PostsListView() {
  const params = usePostListUrl();
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PostStatusFilter params={params} />
        <PostSearchField search={params.search} />
      </div>
      <PostListBody params={params} />
    </>
  );
}

function PostListBody({ params }: { params: PostListParams }) {
  const { data: postPage, isPending, isPlaceholderData, refetch } = useAdminPosts(params);

  if (isPending) return <PostListLoading />;
  // Дані є — показуємо їх, навіть коли фонове оновлення впало
  if (!postPage) return <PostListError params={params} onRetry={() => void refetch()} />;
  if (postPage.total === 0) return <NoPosts params={params} />;
  if (params.page > postPage.totalPages) {
    return <PageOutOfRange params={params} totalPages={postPage.totalPages} />;
  }

  const timeZone = editorTimeZone();
  return (
    <>
      <p role="status" className="mb-3 text-sm text-gray-400">
        {postPage.total} {postPage.total === 1 ? 'post' : 'posts'}
      </p>
      {/* Попередня сторінка, поки вантажиться наступна, — приглушена */}
      <ul
        aria-busy={isPlaceholderData}
        className={`space-y-3 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
      >
        {postPage.data.map((post) => (
          <PostListRow key={post.id} post={post} timeZone={timeZone} />
        ))}
      </ul>
      {postPage.totalPages > 1 && <PostsPager params={params} totalPages={postPage.totalPages} />}
    </>
  );
}
