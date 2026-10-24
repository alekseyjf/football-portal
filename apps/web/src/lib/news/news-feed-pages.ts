import type { PaginatedPosts, PostSummary } from '@/lib/api/types';

/**
 * Сторінки «Завантажити ще» — одним списком (D38). Сторінки — offset: нова новина зсуває їх, і наступна сторінка
 * починається з новини, яку вже показано, — вона лишається на першому місці, без повтору.
 */
export function uniquePostsOfPages(pages: PaginatedPosts[]): PostSummary[] {
  const shownPostIds = new Set<string>();
  const posts: PostSummary[] = [];
  for (const page of pages) {
    for (const post of page.data) {
      if (shownPostIds.has(post.id)) continue;
      shownPostIds.add(post.id);
      posts.push(post);
    }
  }
  return posts;
}

/** Перша новина, яку додала остання завантажена сторінка; `null` — нових немає (усі вже показані). */
export function firstPostOfLastPage(pages: PaginatedPosts[]): PostSummary | null {
  const shownBefore = uniquePostsOfPages(pages.slice(0, -1)).length;
  return uniquePostsOfPages(pages)[shownBefore] ?? null;
}
