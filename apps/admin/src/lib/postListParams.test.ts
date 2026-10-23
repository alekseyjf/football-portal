import { ADMIN_POSTS_SEARCH_MAX_LENGTH, PAGE_NUMBER_MAX } from '@football-portal/validation';
import { describe, expect, it } from 'vitest';
import {
  adminPostsApiPath,
  parsePostListParams,
  postListHref,
  restorePostListHref,
  type PostListParams,
} from './postListParams';

function paramsOf(query: string): PostListParams {
  return parsePostListParams(new URLSearchParams(query));
}

describe('parsePostListParams: адреса списку → стан, який прийме API', () => {
  it('без параметрів — усі статуси, без пошуку, перша сторінка', () => {
    expect(paramsOf('')).toEqual({ status: null, search: '', page: 1 });
  });

  it('статус — лише відомий і як в API; інший — усі статуси', () => {
    expect(paramsOf('status=ARCHIVED').status).toBe('ARCHIVED');
    for (const status of ['draft', 'DELETED', '']) {
      expect(paramsOf(`status=${status}`).status).toBeNull();
    }
  });

  it('сторінка — ціле від 1 до межі API; інша — перша', () => {
    expect(paramsOf('page=3').page).toBe(3);
    expect(paramsOf(`page=${PAGE_NUMBER_MAX}`).page).toBe(PAGE_NUMBER_MAX);
    for (const page of ['0', '-2', '1.5', '1e3', 'abc', '', ' 2', `${PAGE_NUMBER_MAX + 1}`]) {
      expect(paramsOf(`page=${encodeURIComponent(page)}`).page).toBe(1);
    }
  });

  it('пошук — без пробілів по краях; з самих пробілів — без пошуку', () => {
    expect(paramsOf('search=%20%20Динамо%20Київ%20').search).toBe('Динамо Київ');
    expect(paramsOf('search=%20%20%20').search).toBe('');
  });

  it('задовгий пошук обрізано до межі API, і пробіл на місці зрізу теж прибрано', () => {
    const longSearch = `${'a'.repeat(ADMIN_POSTS_SEARCH_MAX_LENGTH - 1)} ${'b'.repeat(20)}`;
    expect(paramsOf(`search=${longSearch}`).search).toBe('a'.repeat(ADMIN_POSTS_SEARCH_MAX_LENGTH - 1));
  });
});

describe('postListHref: стан → адреса списку', () => {
  it('типові значення в адресу не йдуть', () => {
    expect(postListHref({ status: null, search: '', page: 1 })).toBe('/dashboard/posts');
  });

  it('адреса читається назад у той самий стан, і «&», «%», лапки в пошуку — не нові параметри', () => {
    const params: PostListParams = { status: 'DRAFT', search: '50% & "Динамо" ?page=9', page: 2 };
    const href = postListHref(params);
    expect(href.startsWith('/dashboard/posts?')).toBe(true);
    expect(paramsOf(href.slice(href.indexOf('?') + 1))).toEqual(params);
  });
});

describe('adminPostsApiPath: стан → запит до API', () => {
  it('«усі статуси» і порожній пошук не надсилаються — на `search=` API відповідає 400', () => {
    expect(adminPostsApiPath({ status: null, search: '', page: 1 })).toBe('/posts/admin/all?page=1&limit=20');
  });

  it('статус і пошук — закодованими параметрами', () => {
    const query = new URLSearchParams(
      adminPostsApiPath({ status: 'PUBLISHED', search: 'a&b%', page: 4 }).split('?')[1],
    );
    expect(Object.fromEntries(query)).toEqual({ page: '4', limit: '20', status: 'PUBLISHED', search: 'a&b%' });
  });
});

describe('restorePostListHref: збережена адреса → куди повертатись зі сторінки новини', () => {
  it('немає збереженої — список без фільтрів', () => {
    expect(restorePostListHref(null)).toBe('/dashboard/posts');
  });

  it('адреса списку — той самий стан', () => {
    expect(restorePostListHref('/dashboard/posts?status=SCHEDULED&search=derby&page=2')).toBe(
      '/dashboard/posts?status=SCHEDULED&search=derby&page=2',
    );
  });

  it('з будь-якого значення — лише адреса списку, не чужа сторінка', () => {
    for (const storedHref of ['/dashboard/posts/123', '/login', '//example.com', '']) {
      expect(restorePostListHref(storedHref)).toBe('/dashboard/posts');
    }
    expect(restorePostListHref('https://example.com/login?status=DRAFT')).toBe('/dashboard/posts?status=DRAFT');
  });

  it('стан — у межах API: зайве відкинуто', () => {
    expect(restorePostListHref('/dashboard/posts?page=0&status=draft&search=%20&utm=x')).toBe('/dashboard/posts');
  });
});
