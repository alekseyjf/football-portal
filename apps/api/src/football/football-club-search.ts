import { ADMIN_CLUBS_SEARCH_MAX_LENGTH } from '@football-portal/validation';
import type { Prisma } from '@prisma/client';
import { slugify } from '../common/slug';
import { containsIgnoringCase } from '../prisma/prisma-text-search';

/**
 * Скільки збігів пошуку клубів читаємо з БД перед ранжуванням (D48). Клубів на dev-БД 186 — поки це всі збіги
 * будь-якого запиту; коли їх стане більше, ранжуються перші 200 за абеткою.
 */
export const CLUB_SEARCH_CANDIDATES_MAX = 200;

/** Поля клубу, за якими шукаємо й ранжуємо. */
export interface ClubSearchFields {
  slug: string;
  name: string;
  shortName: string | null;
  tla: string | null;
}

/** Назви клубів — як у провайдера, англійською (D42). */
const CLUB_NAME_COLLATOR = new Intl.Collator('en');

/**
 * Запит у формі адреси — тим самим `slugify`, що й адреси новин і тегів: діакритику знято, пробіли й розділові
 * знаки → дефіс («Atlético» → `atletico`). Кирилицю `slugify` відкидає: «Динамо» → `null`, і адреса в пошуку
 * не бере участі. Межа довжини — як у запиту: справжній запит вона не обріже.
 */
function searchAsSlug(search: string): string | null {
  return slugify(search, ADMIN_CLUBS_SEARCH_MAX_LENGTH);
}

/**
 * Умова пошуку клубів для форми новини (D48): запит — частина назви, короткої назви чи коду (`ARS`) без
 * урахування регістру (`%` і `_` — як текст), або запит у формі адреси — частина slug-а клубу. Так «atletico»
 * знаходить «Club Atlético de Madrid», хоч у назві «é».
 */
export function clubSearchWhere(search: string): Prisma.ClubWhereInput {
  const conditions: Prisma.ClubWhereInput[] = [
    { name: containsIgnoringCase(search) },
    { shortName: containsIgnoringCase(search) },
    { tla: containsIgnoringCase(search) },
  ];
  const slugSearch = searchAsSlug(search);
  // У формі адреси лише a-z, 0-9 і дефіс: `%`, `_` та інші розділові знаки, як і пробіл, стали межею слова —
  // символів шаблону LIKE там немає
  if (slugSearch) conditions.push({ slug: { contains: slugSearch } });
  return { OR: conditions };
}

/**
 * Порядок результатів пошуку клубів (D48): спершу ті, у кого з запиту починається будь-яке з полів — назва,
 * коротка назва чи код без урахування регістру, адреса — з запиту у формі адреси; далі — за абеткою назви.
 * «fc» → «FC Barcelona» раніше за «Arsenal FC». Повертає перші `limit`.
 */
export function rankClubSearchResults<ClubRow extends ClubSearchFields>(
  clubs: readonly ClubRow[],
  search: string,
  limit: number,
): ClubRow[] {
  const lowerCaseSearch = search.toLowerCase();
  const slugSearch = searchAsSlug(search);
  const startsWithSearch = (club: ClubRow): boolean =>
    [club.name, club.shortName, club.tla].some((field) =>
      field?.toLowerCase().startsWith(lowerCaseSearch),
    ) ||
    (slugSearch !== null && club.slug.startsWith(slugSearch));
  return clubs
    .map((club) => ({ club, isPrefixMatch: startsWithSearch(club) }))
    .sort(
      (first, second) =>
        Number(second.isPrefixMatch) - Number(first.isPrefixMatch) ||
        CLUB_NAME_COLLATOR.compare(first.club.name, second.club.name) ||
        CLUB_NAME_COLLATOR.compare(first.club.slug, second.club.slug),
    )
    .slice(0, limit)
    .map(({ club }) => club);
}
