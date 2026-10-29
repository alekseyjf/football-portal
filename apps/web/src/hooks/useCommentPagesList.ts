import { useState } from 'react';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { CommentPage } from '@/lib/api/types';
import {
  firstCommentOfLastPage,
  uniqueCommentsOfPages,
  type CommentPages,
} from '@/lib/comments/comment-pages';

/**
 * `ref` коментаря, на який переводимо фокус: одна функція на всіх — React викликає її, лише коли ref з'являється
 * (елемент змонтовано чи фокус перейшов на нього), а не на кожен рендер.
 */
export function focusOnAttach(element: HTMLElement | null) {
  element?.focus();
}

/**
 * Порції коментарів (корені чи гілка) одним списком і «Показати ще»: після дозавантаження — фокус на першому новому
 * коментарі, щоб клавіатура й екранний диктор продовжили з нього (як у стрічці новин).
 */
export function useCommentPagesList<Page extends CommentPage>(
  pagesQuery: UseInfiniteQueryResult<CommentPages<Page>>,
) {
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);

  async function loadMore() {
    if (pagesQuery.isFetchingNextPage) return;
    const result = await pagesQuery.fetchNextPage();
    if (result.isFetchNextPageError || !result.data) return;
    const firstNewComment = firstCommentOfLastPage(result.data.pages);
    if (firstNewComment) setFocusCommentId(firstNewComment.id);
  }

  return {
    comments: uniqueCommentsOfPages(pagesQuery.data?.pages ?? []),
    loadMore,
    focusCommentId,
  };
}
