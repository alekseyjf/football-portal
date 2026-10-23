import { slugify } from '@football-portal/validation';
import type { AdminClubSearchResult, AdminLeague } from '@/lib/api/types';

/** Довше за будь-яку назву клубу, турніру чи тегу: `slugify` тут лише нормалізує й не обрізає. */
const COMPARED_NAME_MAX_LENGTH = 200;

type CompetitionNames = Pick<AdminLeague, 'slug' | 'name'>;
type ClubNames = Pick<AdminClubSearchResult, 'name' | 'shortName' | 'tla'>;

export interface FootballNameMatches<Competition extends CompetitionNames, Club extends ClubNames> {
  competitions: Competition[];
  clubs: Club[];
}

/** Назва — рядком слів через дефіс: регістр, діакритика й розділові знаки не важать («Barça» = «barca»). */
function asWords(name: string): string | null {
  return slugify(name, COMPARED_NAME_MAX_LENGTH);
}

/** `words` — цілі слова назви поспіль: «arsenal» є в «arsenal-fc», а «arse» — ні. */
function containsWords(nameWords: string, words: string): boolean {
  return `-${nameWords}-`.includes(`-${words}-`);
}

/**
 * Клуби й турніри, з якими збігається назва тегу (D51): тег — тема новини, а клуб і турнір прив'язують своїми полями
 * (D46). Збіг — назва тегу дорівнює короткій назві чи коду клубу (`Man United`, `PSG`) або коду турніру (`PL`) чи
 * цілими словами входить у повну назву («Arsenal» → «Arsenal FC», «Champions League» → «UEFA Champions League»).
 * Назви клубів і турнірів — латиницею (D42), тож порівнюється англійська назва тегу; без латиниці — збігів немає.
 */
export function findFootballNameMatches<Competition extends CompetitionNames, Club extends ClubNames>(
  tagName: string,
  candidates: { competitions: readonly Competition[]; clubs: readonly Club[] },
): FootballNameMatches<Competition, Club> {
  const tagWords = asWords(tagName);
  if (!tagWords) return { competitions: [], clubs: [] };
  const isSameName = (name: string | null) => name !== null && asWords(name) === tagWords;
  const isPartOfName = (name: string) => {
    const nameWords = asWords(name);
    return nameWords !== null && containsWords(nameWords, tagWords);
  };
  return {
    competitions: candidates.competitions.filter(
      (competition) => isSameName(competition.slug) || isPartOfName(competition.name),
    ),
    clubs: candidates.clubs.filter(
      (club) => isSameName(club.shortName) || isSameName(club.tla) || isPartOfName(club.name),
    ),
  };
}
