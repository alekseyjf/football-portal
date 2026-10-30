import { POST_NUMBER_MAX } from '@football-portal/validation';

/**
 * Згенеровані картки прев'ю в соцмережах (`app/[locale]/og/…`, `lib/seo/og-card.tsx`) — коли обкладинки немає: назва
 * сторінки й сайту. Адреси — без мови: мову додає `pageMetadata`.
 */
export const SHARE_CARD_PAGES = ['home', 'news', 'matches'] as const;
export type ShareCardPage = (typeof SHARE_CARD_PAGES)[number];

export function isShareCardPage(value: string): value is ShareCardPage {
  return (SHARE_CARD_PAGES as readonly string[]).includes(value);
}

export function pageShareCardHref(page: ShareCardPage): string {
  return `/og/page/${page}`;
}

/** Картка новини — за номером: зміна slug-а адресу картки не змінює. */
export function postShareCardHref(postNumber: number): string {
  return `/og/post/${postNumber}`;
}

export function matchShareCardHref(matchId: string): string {
  return `/og/match/${encodeURIComponent(matchId)}`;
}

const DIGITS_PATTERN = /^\d+$/;

/** Номер новини з адреси картки; `null` — не номер або поза межами `Post.number`. */
export function parseShareCardPostNumber(segment: string): number | null {
  if (!DIGITS_PATTERN.test(segment)) return null;
  const postNumber = Number(segment);
  return postNumber >= 1 && postNumber <= POST_NUMBER_MAX ? postNumber : null;
}
