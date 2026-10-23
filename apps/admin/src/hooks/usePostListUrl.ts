import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import {
  normalizePostListSearch,
  parsePostListParams,
  postListHref,
  type PostListParams,
} from '@/lib/postListParams';
import { rememberPostListHref } from './useLastPostListHref';

/**
 * Стан списку новин з адреси (D50). Адресу змінюють `history.pushState` / `replaceState`: Next синхронізує з
 * ними `useSearchParams` без запиту до сервера. Свою адресу список запам'ятовує: «← All posts», Cancel і
 * перехід після видалення ведуть назад у той самий стан.
 */
export function usePostListUrl(): PostListParams {
  const searchParams = useSearchParams();
  const params = useMemo(() => parsePostListParams(searchParams), [searchParams]);
  const href = postListHref(params);
  useEffect(() => rememberPostListHref(href), [href]);
  return params;
}

/** Фільтр, сторінка — новий запис історії: «Назад» повертає попередній стан. */
export function pushPostListHref(href: string): void {
  window.history.pushState(null, '', href);
}

/**
 * Пошук — з першої сторінки, заміною запису історії: кожна пауза в наборі не стає кроком «Назад». Стан — з
 * адреси в мить запису, а не з рендеру: поки йшла затримка, редактор міг змінити фільтр.
 */
export function replacePostListSearch(value: string): void {
  const current = parsePostListParams(new URLSearchParams(window.location.search));
  const search = normalizePostListSearch(value);
  if (search === current.search) return;
  window.history.replaceState(null, '', postListHref({ ...current, search, page: 1 }));
}
