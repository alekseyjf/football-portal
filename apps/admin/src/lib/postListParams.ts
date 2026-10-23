import {
  ADMIN_POSTS_PAGE_LIMIT_DEFAULT,
  ADMIN_POSTS_SEARCH_MAX_LENGTH,
  PAGE_NUMBER_MAX,
} from '@football-portal/validation';
import type { AdminPost } from '@/lib/api/types';

/**
 * Стан списку новин — в адресі сторінки (D50): `/dashboard/posts?status=DRAFT&search=…&page=2`. Повернення з
 * редагування, «Назад» і посилання в новій вкладці відкривають той самий список.
 */

/** Статус новини в API (`PostStatus`). */
export type PostStatus = AdminPost['status'];

export const POST_LIST_PATH = '/dashboard/posts';

/** Фільтр списку — у порядку життя новини. */
export const POST_LIST_STATUSES: readonly PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];

export interface PostListParams {
  /** `null` — усі статуси */
  status: PostStatus | null;
  /** Частина заголовка без пробілів по краях; `''` — без пошуку */
  search: string;
  page: number;
}

/** Пошук, який прийме API: без пробілів по краях і не довший за `ADMIN_POSTS_SEARCH_MAX_LENGTH`. */
export function normalizePostListSearch(value: string): string {
  return value.trim().slice(0, ADMIN_POSTS_SEARCH_MAX_LENGTH).trim();
}

function parseStatus(value: string | null): PostStatus | null {
  return POST_LIST_STATUSES.find((status) => status === value) ?? null;
}

function parsePage(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= PAGE_NUMBER_MAX ? page : 1;
}

/**
 * Адреса → стан списку: невідомий статус — усі, некоректна сторінка — перша, задовгий пошук обрізано. Будь-яка
 * адреса (вписана руками, старе посилання) дає запит, який API прийме, а не 400.
 */
export function parsePostListParams(searchParams: Pick<URLSearchParams, 'get'>): PostListParams {
  return {
    status: parseStatus(searchParams.get('status')),
    search: normalizePostListSearch(searchParams.get('search') ?? ''),
    page: parsePage(searchParams.get('page')),
  };
}

/** Стан → адреса списку; типові значення (усі статуси, без пошуку, перша сторінка) в адресу не йдуть. */
export function postListHref(params: PostListParams): string {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page > 1) query.set('page', String(params.page));
  const queryString = query.toString();
  return queryString ? `${POST_LIST_PATH}?${queryString}` : POST_LIST_PATH;
}

/** Стан → запит сторінки списку до API. Порожній пошук не надсилається: на `search=` API відповідає 400. */
export function adminPostsApiPath(params: PostListParams): string {
  const query = new URLSearchParams({ page: String(params.page), limit: String(ADMIN_POSTS_PAGE_LIMIT_DEFAULT) });
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  return `/posts/admin/all?${query.toString()}`;
}

/**
 * Збережена адреса списку (sessionStorage — дані поза кодом) → адреса для «← All posts». Адреса будується наново
 * зі стану (`parsePostListParams`), тож з будь-якого значення виходить лише список у межах API, а не чужа сторінка.
 */
export function restorePostListHref(storedHref: string | null): string {
  const query = storedHref?.split('?').slice(1).join('?') ?? '';
  return postListHref(parsePostListParams(new URLSearchParams(query)));
}
