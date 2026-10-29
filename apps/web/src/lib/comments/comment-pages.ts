import type { InfiniteData } from '@tanstack/react-query';
import type {
  CommentItem,
  CommentPage,
  CommentRootsPage,
  LikeStats,
} from '@/lib/api/types';

/** Кеш порцій (`useInfiniteQuery`): коренів чи відповідей гілки; параметри порцій — курсори (D27), їх не чіпаємо. */
export type CommentPages<Page extends CommentPage = CommentPage> =
  InfiniteData<Page>;

/**
 * Порції — одним списком. Курсор «Нових» дублів не дає (D27), але свій коментар сайт уставляє в кеш сам — і порція, що
 * прийшла після запису, вже його містить: лишається перший, тож коментар не стрибає.
 */
export function uniqueCommentsOfPages(pages: CommentPage[]): CommentItem[] {
  const shownCommentIds = new Set<string>();
  const comments: CommentItem[] = [];
  for (const page of pages) {
    for (const comment of page.items) {
      if (shownCommentIds.has(comment.id)) continue;
      shownCommentIds.add(comment.id);
      comments.push(comment);
    }
  }
  return comments;
}

/** Перший коментар, який додала остання порція; `null` — нових немає. */
export function firstCommentOfLastPage(pages: CommentPage[]): CommentItem | null {
  const shownBefore = uniqueCommentsOfPages(pages.slice(0, -1)).length;
  return uniqueCommentsOfPages(pages)[shownBefore] ?? null;
}

/** «N коментарів» — з останньої порції: вона найсвіжіша. `null` — ще нічого не завантажено. */
export function commentCountOfPages(pages: CommentRootsPage[]): number | null {
  return pages.at(-1)?.commentCount ?? null;
}

function containsComment(data: CommentPages, commentId: string): boolean {
  return data.pages.some((page) =>
    page.items.some((comment) => comment.id === commentId),
  );
}

/**
 * Свій новий корінь — нагорі першої порції при будь-якому порядку (D27), «N коментарів» +1 у кожній порції. Уже є
 * (порція прийшла після запису й лічильник його врахував) — без змін.
 */
export function prependOwnRoot(
  data: CommentPages<CommentRootsPage>,
  comment: CommentItem,
): CommentPages<CommentRootsPage> {
  if (containsComment(data, comment.id)) return data;
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: index === 0 ? [comment, ...page.items] : page.items,
      commentCount: page.commentCount + 1,
    })),
  };
}

/**
 * Своя нова відповідь — у кінці завантажених (D27), навіть якщо гілка має ще порції: коли дійде до неї, порція її
 * не повторить (`uniqueCommentsOfPages`).
 */
export function appendOwnReply(
  data: CommentPages,
  reply: CommentItem,
): CommentPages {
  if (containsComment(data, reply.id)) return data;
  const lastIndex = data.pages.length - 1;
  return {
    ...data,
    pages: data.pages.map((page, index) =>
      index === lastIndex ? { ...page, items: [...page.items, reply] } : page,
    ),
  };
}

/** Коментар порцій за id — новим об'єктом: кеш TanStack Query не мутуємо. Немає — ті самі дані. */
export function updateCommentInPages<Page extends CommentPage>(
  data: CommentPages<Page>,
  commentId: string,
  update: (comment: CommentItem) => CommentItem,
): CommentPages<Page> {
  if (!containsComment(data, commentId)) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((comment) =>
        comment.id === commentId ? update(comment) : comment,
      ),
    })),
  };
}

/** Своя відповідь у корені гілки: «N відповідей» +1 і «N коментарів» +1 (так рахує API, D27). */
export function countOwnReply(
  data: CommentPages<CommentRootsPage>,
  rootId: string,
): CommentPages<CommentRootsPage> {
  const withReply = updateCommentInPages(data, rootId, (root) => ({
    ...root,
    replyCount: root.replyCount + 1,
  }));
  return {
    ...withReply,
    pages: withReply.pages.map((page) => ({
      ...page,
      commentCount: page.commentCount + 1,
    })),
  };
}

export function findCommentInPages(
  data: CommentPages,
  commentId: string,
): CommentItem | null {
  for (const page of data.pages) {
    const comment = page.items.find((item) => item.id === commentId);
    if (comment) return comment;
  }
  return null;
}

/** Голос коментаря у формі `LikeStats` — щоб перемикати його тим самим правилом, що й лайк новини. */
export function likeStatsOfComment(comment: CommentItem): LikeStats {
  return { likesCount: comment.likeCount, myReaction: comment.myReaction };
}

export function withLikeStats(comment: CommentItem, stats: LikeStats): CommentItem {
  return { ...comment, likeCount: stats.likesCount, myReaction: stats.myReaction };
}
