import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NewsFeedFilters } from '@/lib/news/news-feed-filters';
import {
  firstPostOfLastPage,
  uniquePostsOfPages,
} from '@/lib/news/news-feed-pages';
import { newsFeedQueryOptions } from '@/lib/news/news-feed-query';
import { useApiContentLang } from './useApiContentLang';

/**
 * Стрічка з «Завантажити ще»: новини завантажених сторінок без дублів (D38), номер наступної сторінки для посилання;
 * після дозавантаження — фокус на першій новій новині, щоб клавіатура й екранний диктор продовжили з неї.
 */
export function useNewsFeed(filters: NewsFeedFilters, startPage: number) {
  const lang = useApiContentLang();
  const feedQuery = useInfiniteQuery(
    newsFeedQueryOptions(filters, lang, startPage),
  );
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const pages = feedQuery.data?.pages ?? [];
  const lastLoadedPage = pages.at(-1)?.page ?? startPage;

  async function loadMore() {
    if (feedQuery.isFetchingNextPage) return;
    const result = await feedQuery.fetchNextPage();
    if (result.isFetchNextPageError || !result.data) return;
    const firstNewPost = firstPostOfLastPage(result.data.pages);
    if (firstNewPost) setFocusPostId(firstNewPost.id);
  }

  return {
    feedQuery,
    posts: uniquePostsOfPages(pages),
    nextPage: feedQuery.hasNextPage ? lastLoadedPage + 1 : null,
    loadMore,
    focusPostId,
  };
}
