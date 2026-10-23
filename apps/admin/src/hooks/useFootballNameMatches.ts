import { useMemo } from 'react';
import { findFootballNameMatches } from '@/lib/footballNameMatches';
import { useAdminClubSearch } from './useAdminClubSearch';
import { useAdminLeagues } from './useAdminLeagues';
import { useDebouncedValue } from './useDebouncedValue';

const NAME_CHECK_DELAY_MS = 400;
/** Назви клубів — латиницею (D42): назву без латиниці й цифр серед них шукати нема чого. */
const LATIN_LETTER_OR_DIGIT = /[\p{Script=Latin}\p{N}]/u;

/**
 * Клуби й турніри з тією самою назвою, що й тег (D51), — для попередження у формах тегу. Турніри — усі одним
 * списком, клуби — пошуком API після паузи у вводі; порівнює `findFootballNameMatches`.
 */
export function useFootballNameMatches(tagNameEn: string) {
  const checkedName = useDebouncedValue(tagNameEn.trim(), NAME_CHECK_DELAY_MS);
  const { data: competitions } = useAdminLeagues();
  const { data: clubs } = useAdminClubSearch(LATIN_LETTER_OR_DIGIT.test(checkedName) ? checkedName : '');
  return useMemo(
    () => findFootballNameMatches(checkedName, { competitions: competitions ?? [], clubs: clubs ?? [] }),
    [checkedName, competitions, clubs],
  );
}
