import { describe, expect, it } from 'vitest';
import type { CommentItem, CommentPage, CommentRootsPage } from '@/lib/api/types';
import {
  appendOwnReply,
  commentCountOfPages,
  countOwnReply,
  firstCommentOfLastPage,
  prependOwnRoot,
  uniqueCommentsOfPages,
  updateCommentInPages,
  type CommentPages,
} from './comment-pages';

function comment(id: string, overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id,
    parentId: null,
    content: `Comment ${id}`,
    author: { id: 'author', name: 'Olena', avatarUrl: null, isDeleted: false },
    isDeleted: false,
    createdAt: '2026-10-29T10:00:00.000Z',
    editedAt: null,
    likeCount: 0,
    myReaction: null,
    replyCount: 0,
    replyTo: null,
    ...overrides,
  };
}

function rootsPage(
  commentIds: string[],
  commentCount: number,
  nextCursor: string | null = null,
): CommentRootsPage {
  return { items: commentIds.map((id) => comment(id)), nextCursor, commentCount };
}

function repliesPage(replyIds: string[], nextCursor: string | null = null): CommentPage {
  return {
    items: replyIds.map((id) => comment(id, { parentId: 'root' })),
    nextCursor,
  };
}

function pagesOf<Page extends CommentPage>(...pages: Page[]): CommentPages<Page> {
  return {
    pages,
    pageParams: pages.map((_page, index) => (index === 0 ? null : `cursor-${index}`)),
  };
}

function ids(comments: CommentItem[]): string[] {
  return comments.map((item) => item.id);
}

describe('порції коментарів одним списком (D27)', () => {
  it('порції — у порядку видачі; дубль (свій коментар, який уже приніс refetch) — один раз, на першому місці', () => {
    expect(
      ids(uniqueCommentsOfPages([rootsPage(['mine', 'a'], 3), rootsPage(['b', 'mine'], 3)])),
    ).toEqual(['mine', 'a', 'b']);
  });

  it('перший новий коментар останньої порції — для фокуса після «Показати ще»; усі вже показані — null', () => {
    expect(
      firstCommentOfLastPage([rootsPage(['a', 'b'], 4, 'next'), rootsPage(['c', 'd'], 4)])
        ?.id,
    ).toBe('c');
    expect(
      firstCommentOfLastPage([repliesPage(['a', 'mine'], 'next'), repliesPage(['mine'])]),
    ).toBeNull();
  });

  it('«N коментарів» — з останньої порції; до першої — null', () => {
    expect(commentCountOfPages([rootsPage(['a'], 5, 'next'), rootsPage(['b'], 7)])).toBe(7);
    expect(commentCountOfPages([])).toBeNull();
  });
});

describe('свій новий коментар — у кеш без перезапиту (D27)', () => {
  it('корінь — нагорі першої порції, лічильник +1 у кожній; наступні порції — як були', () => {
    const before = pagesOf(rootsPage(['a', 'b'], 4, 'next'), rootsPage(['c', 'd'], 4));
    const after = prependOwnRoot(before, comment('mine'));

    expect(ids(uniqueCommentsOfPages(after.pages))).toEqual(['mine', 'a', 'b', 'c', 'd']);
    expect(after.pages.map((page) => page.commentCount)).toEqual([5, 5]);
    expect(after.pages[1].items).toBe(before.pages[1].items);
    expect(after.pageParams).toEqual(before.pageParams);
  });

  it('корінь уже в порції (refetch встиг після запису) — без дубля й без зайвого +1', () => {
    const before = pagesOf(rootsPage(['mine', 'a'], 3));
    expect(prependOwnRoot(before, comment('mine'))).toBe(before);
  });

  it('відповідь — у кінці завантажених, навіть коли в гілки є ще порції; та сама порція пізніше — без дубля', () => {
    const before = pagesOf(repliesPage(['r1', 'r2'], 'next'));
    const withMine = appendOwnReply(before, comment('mine', { parentId: 'root' }));
    expect(ids(uniqueCommentsOfPages(withMine.pages))).toEqual(['r1', 'r2', 'mine']);
    expect(appendOwnReply(withMine, comment('mine'))).toBe(withMine);

    // Дійшли до наступної порції — вона містить і мою відповідь
    const withNextPage = { ...withMine, pages: [...withMine.pages, repliesPage(['r3', 'mine'])] };
    expect(ids(uniqueCommentsOfPages(withNextPage.pages))).toEqual(['r1', 'r2', 'mine', 'r3']);
  });

  it('відповідь рахується в корені гілки й у «N коментарів»', () => {
    const before = pagesOf(
      rootsPage(['other'], 4, 'next'),
      { items: [comment('root', { replyCount: 2 })], nextCursor: null, commentCount: 4 },
    );
    const after = countOwnReply(before, 'root');
    expect(after.pages[1].items[0].replyCount).toBe(3);
    expect(after.pages[0].items[0].replyCount).toBe(0);
    expect(after.pages.map((page) => page.commentCount)).toEqual([5, 5]);
  });
});

describe('зміна коментаря в кеші (лайк)', () => {
  it('новим об’єктом, решта коментарів — ті самі; невідомий id — ті самі дані', () => {
    const before = pagesOf(repliesPage(['a', 'b']));
    const after = updateCommentInPages(before, 'b', (item) => ({ ...item, likeCount: 1 }));

    expect(after.pages[0].items[1].likeCount).toBe(1);
    expect(before.pages[0].items[1].likeCount).toBe(0);
    expect(after.pages[0].items[0]).toBe(before.pages[0].items[0]);
    expect(updateCommentInPages(before, 'missing', (item) => item)).toBe(before);
  });
});
