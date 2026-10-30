import {
  CLUB_SLUG_MAX_LENGTH,
  PAGE_NUMBER_MAX,
  POSTS_FILTER_VALUES_MAX,
  SLUG_PATTERN,
  TAG_SLUG_MAX_LENGTH,
} from '@football-portal/validation';
import type { ApiContentLanguage } from '@/lib/api/types';
import { isLeagueSlug } from '@/lib/football/league-param';

/**
 * Фільтри стрічки `/news` — ті самі параметри, що й `GET /posts` (D46): `?tags=transfers,injuries&competition=PL&club=arsenal`.
 * Усередині фільтра — «будь-який», між фільтрами — «і». Ліга — одна (вкладки), теги й клуби — з посилань новини,
 * їх може бути кілька (M1.6.1).
 */
export type NewsFeedFilters = {
  /** Slug-и тегів (`?tags=`) */
  tags: string[];
  /** Код турніру (`?competition=`) — вкладка ліги */
  competition: string | null;
  /** Slug-и клубів (`?club=`) */
  clubs: string[];
};

export const NO_NEWS_FEED_FILTERS: NewsFeedFilters = {
  tags: [],
  competition: null,
  clubs: [],
};

/** Значення параметра адреси, як його віддає Next (`searchParams`): повтор параметра — масив. */
type SearchParamValue = string | string[] | undefined;
export type NewsFeedSearchParams = Partial<Record<string, SearchParamValue>>;

const NEWS_FEED_PATHNAME = '/news';
const SLUG_LIST_SEPARATOR = ',';
const PAGE_PARAM = 'page';
const DIGITS_PATTERN = /^\d+$/;

/** Повтор параметра (`?tags=a&tags=b`) — перше значення, як `URLSearchParams.get` у браузері. */
function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTagSlug(slug: string): boolean {
  return slug.length <= TAG_SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

function isClubSlug(slug: string): boolean {
  return slug.length <= CLUB_SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

/**
 * Slug-и з адреси: через кому, без порожніх, повторів і значень не того формату, до `POSTS_FILTER_VALUES_MAX`. API на
 * таке відповів би 400 (D46), а сторінка не ламається — фільтр лише без них. Невідомий slug лишається: API дасть
 * порожню сторінку.
 */
function slugListFromParam(
  value: SearchParamValue,
  isValidSlug: (slug: string) => boolean,
): string[] {
  const slugs = new Set<string>();
  for (const part of (firstValue(value) ?? '').split(SLUG_LIST_SEPARATOR)) {
    if (slugs.size === POSTS_FILTER_VALUES_MAX) break;
    const slug = part.trim();
    if (slug && isValidSlug(slug)) slugs.add(slug);
  }
  return [...slugs];
}

export function parseNewsFeedFilters(
  searchParams: NewsFeedSearchParams,
): NewsFeedFilters {
  return {
    tags: slugListFromParam(searchParams.tags, isTagSlug),
    // Вкладки ліг — один вибір: з кількох (`PL,CL` — таких посилань сайт не робить) — перший
    competition:
      slugListFromParam(searchParams.competition, isLeagueSlug)[0] ?? null,
    clubs: slugListFromParam(searchParams.club, isClubSlug),
  };
}

/** Що сторінка стрічки робить з `?page=` (D52): рендерить, переадресовує на канонічну адресу чи віддає 404. */
export type NewsFeedPageRequest =
  | { kind: 'page'; page: number }
  | { kind: 'redirect'; page: number }
  | { kind: 'notFound' };

/**
 * `?page=` → номер сторінки. Канонічний запис — лише `?page=N` для N ≥ 2, перша сторінка — без параметра. Інший запис
 * тієї самої сторінки (`?page=1`, `02`, повтор параметра) і невалідне значення (`abc`, `0`, `-1`, `2.5` — перша) —
 * переадресація: у пошуку в сторінки одна адреса. Номер понад `PAGE_NUMBER_MAX` API не прийме — такої сторінки немає.
 */
export function resolveNewsFeedPage(
  value: SearchParamValue,
): NewsFeedPageRequest {
  if (value === undefined) return { kind: 'page', page: 1 };
  const pageText = firstValue(value)?.trim() ?? '';
  const requestedPage = DIGITS_PATTERN.test(pageText) ? Number(pageText) : 0;
  if (requestedPage > PAGE_NUMBER_MAX) return { kind: 'notFound' };
  const page = Math.max(requestedPage, 1);
  const isCanonical = page > 1 && value === String(page);
  return isCanonical ? { kind: 'page', page } : { kind: 'redirect', page };
}

/** Параметри адреси в одному порядку (одна комбінація — одна адреса); сторінка 1 — без `page`. */
function newsFeedQueryEntries(
  filters: NewsFeedFilters,
  page: number,
): [string, string][] {
  const entries: [string, string][] = [];
  if (filters.tags.length > 0) {
    entries.push(['tags', filters.tags.join(SLUG_LIST_SEPARATOR)]);
  }
  if (filters.competition) entries.push(['competition', filters.competition]);
  if (filters.clubs.length > 0) {
    entries.push(['club', filters.clubs.join(SLUG_LIST_SEPARATOR)]);
  }
  if (page > 1) entries.push([PAGE_PARAM, String(page)]);
  return entries;
}

/** Значення в адресі: кома між slug-ами — як є, а не `%2C`. */
function encodeQueryValue(value: string): string {
  return value
    .split(SLUG_LIST_SEPARATOR)
    .map(encodeURIComponent)
    .join(SLUG_LIST_SEPARATOR);
}

/**
 * Адреса стрічки без мови — для `Link` з `@/i18n/navigation`: `/news?tags=transfers,injuries&page=2`. Кома — як є, а
 * не `%2C`: адресу читають люди, а значення — лише латиниця, цифри й дефіс.
 */
export function newsFeedHref(filters: NewsFeedFilters, page = 1): string {
  const query = newsFeedQueryEntries(filters, page)
    .map(([name, value]) => `${name}=${encodeQueryValue(value)}`)
    .join('&');
  return query ? `${NEWS_FEED_PATHNAME}?${query}` : NEWS_FEED_PATHNAME;
}

/**
 * Адреса, на яку переадресовує неканонічний `?page=`: ті самі параметри в тому ж порядку — і чужі теж (`utm_*` не
 * губляться), без змін їхніх значень; `page` — останнім, перша сторінка — без нього.
 */
export function newsFeedHrefWithPage(
  searchParams: NewsFeedSearchParams,
  page: number,
): string {
  const entries: string[] = [];
  for (const [name, value] of Object.entries(searchParams)) {
    if (name === PAGE_PARAM || value === undefined) continue;
    for (const singleValue of Array.isArray(value) ? value : [value]) {
      entries.push(
        `${encodeURIComponent(name)}=${encodeQueryValue(singleValue)}`,
      );
    }
  }
  if (page > 1) entries.push(`${PAGE_PARAM}=${page}`);
  return entries.length > 0
    ? `${NEWS_FEED_PATHNAME}?${entries.join('&')}`
    : NEWS_FEED_PATHNAME;
}

/** Запит сторінки стрічки до API: ті самі фільтри, номер, розмір сторінки й мова. */
export function newsFeedApiPath(
  filters: NewsFeedFilters,
  pageRequest: { page: number; limit: number; lang: ApiContentLanguage },
): string {
  const searchParams = new URLSearchParams({
    page: String(pageRequest.page),
    limit: String(pageRequest.limit),
    lang: pageRequest.lang,
  });
  for (const [name, value] of newsFeedQueryEntries(filters, 1)) {
    searchParams.set(name, value);
  }
  return `/posts?${searchParams}`;
}

/**
 * Стрічка для пошуку (M1.8.1, D52): адреса — лише розібрані фільтри й сторінка в сталому порядку (`utm_*` і чужі
 * параметри відкинуто); з будь-яким фільтром — не для індексу (`noindex, follow`, canonical на себе), сторінки `?page=N`
 * без фільтрів — індексуються.
 */
export function newsFeedSearchPage(
  searchParams: NewsFeedSearchParams,
  page: number,
): { href: string; isIndexable: boolean } {
  const filters = parseNewsFeedFilters(searchParams);
  const isFiltered = filters.competition !== null || hasChipFilters(filters);
  return { href: newsFeedHref(filters, page), isIndexable: !isFiltered };
}

/** Є фільтри, які прибирають чипи з «×» — теги й клуби (ліга — вкладками). */
export function hasChipFilters(filters: NewsFeedFilters): boolean {
  return filters.tags.length > 0 || filters.clubs.length > 0;
}

export function withoutTag(
  filters: NewsFeedFilters,
  tagSlug: string,
): NewsFeedFilters {
  return { ...filters, tags: filters.tags.filter((tag) => tag !== tagSlug) };
}

export function withoutClub(
  filters: NewsFeedFilters,
  clubSlug: string,
): NewsFeedFilters {
  return {
    ...filters,
    clubs: filters.clubs.filter((club) => club !== clubSlug),
  };
}
