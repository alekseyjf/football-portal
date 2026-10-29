import { describe, expect, it } from 'vitest';
import type { PaginatedPosts, PostSummary } from '@/lib/api/types';
import { firstPostOfLastPage, uniquePostsOfPages } from './news-feed-pages';

const PAGE_SIZE = 3;

function post(id: string): PostSummary {
  return {
    id,
    number: 1,
    slug: id,
    publishedAt: '2026-10-24T10:00:00.000Z',
    coverImageUrl: null,
    coverImageAlt: null,
    resolvedLanguage: 'en',
    title: `Post ${id}`,
    excerpt: 'Summary',
    author: { id: 'author', name: 'Editor', avatarUrl: null, isDeleted: false },
    tags: [],
    competitions: [],
  };
}

function page(pageNumber: number, postIds: string[]): PaginatedPosts {
  return {
    data: postIds.map(post),
    total: 9,
    page: pageNumber,
    limit: PAGE_SIZE,
    totalPages: 3,
  };
}

function ids(posts: PostSummary[]): string[] {
  return posts.map((feedPost) => feedPost.id);
}

describe('«Завантажити ще» без дублів за id (D38)', () => {
  it('сторінки без перетину — одним списком у порядку стрічки', () => {
    expect(
      ids(
        uniquePostsOfPages([
          page(1, ['a', 'b', 'c']),
          page(2, ['d', 'e', 'f']),
        ]),
      ),
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('нова новина зсунула сторінки: повтор — один раз, на першому місці', () => {
    // Між завантаженнями вийшла новина «new»: друга сторінка тепер починається з «c»
    expect(
      ids(
        uniquePostsOfPages([
          page(1, ['a', 'b', 'c']),
          page(2, ['c', 'd', 'e']),
        ]),
      ),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('перша нова новина останньої сторінки — для фокуса після дозавантаження', () => {
    expect(
      firstPostOfLastPage([page(1, ['a', 'b', 'c']), page(2, ['c', 'd', 'e'])])
        ?.id,
    ).toBe('d');
    expect(firstPostOfLastPage([page(1, ['a', 'b', 'c'])])?.id).toBe('a');
    // Уся сторінка — повтори: нових немає
    expect(
      firstPostOfLastPage([page(1, ['a', 'b', 'c']), page(2, ['b', 'c'])]),
    ).toBeNull();
    expect(firstPostOfLastPage([])).toBeNull();
  });
});
