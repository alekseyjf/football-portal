import { useSyncExternalStore } from 'react';
import { POST_LIST_PATH, restorePostListHref } from '@/lib/postListParams';

/**
 * Останній стан списку новин у цій вкладці — для «← All posts», Cancel і переходу після видалення (D50).
 * sessionStorage, а не пам'ять: адреса переживає перезавантаження сторінки редагування.
 */
const LAST_POST_LIST_HREF_KEY = 'lastPostListHref';

export function rememberPostListHref(href: string): void {
  try {
    sessionStorage.setItem(LAST_POST_LIST_HREF_KEY, href);
  } catch {
    // Сховище вимкнене в браузері: повернення поведе на список без фільтрів (`lastPostListHref`)
  }
}

export function lastPostListHref(): string {
  try {
    return restorePostListHref(sessionStorage.getItem(LAST_POST_LIST_HREF_KEY));
  } catch {
    return POST_LIST_PATH;
  }
}

/** Без підписки: адресу пише лише список, а посилання назад живуть на інших сторінках — їх рендер завжди пізніше. */
const subscribeToNothing = () => () => {};
const serverPostListHref = () => POST_LIST_PATH;

/**
 * `lastPostListHref` для `href`: на сервері сховища немає — список без фільтрів; гідрація бере те саме значення,
 * тож розбіжності HTML немає, а одразу після неї посилання отримує збережену адресу.
 */
export function useLastPostListHref(): string {
  return useSyncExternalStore(subscribeToNothing, lastPostListHref, serverPostListHref);
}
