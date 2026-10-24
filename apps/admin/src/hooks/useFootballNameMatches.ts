import { useMemo } from 'react';
import { findFootballNameMatches } from '@/lib/footballNameMatches';
import { useAdminClubSearch } from './useAdminClubSearch';
import { useAdminLeagues } from './useAdminLeagues';
import { useDebouncedValue } from './useDebouncedValue';

const NAME_CHECK_DELAY_MS = 400;

/**
 * Клуби й турніри з тією самою назвою, що й тег (D51), — для попередження у формах тегу. Турніри — усі одним
 * списком, клуби — пошуком API після паузи у вводі (назву без латиниці пошук не надсилає: клуби звуть латиницею,
 * D42); порівнює `findFootballNameMatches`.
 */
export function useFootballNameMatches(tagNameEn: string) {
  const checkedName = useDebouncedValue(tagNameEn.trim(), NAME_CHECK_DELAY_MS);
  const { data: competitions } = useAdminLeagues();
  const { data: clubs } = useAdminClubSearch(checkedName);
  return useMemo(
    () => findFootballNameMatches(checkedName, { competitions: competitions ?? [], clubs: clubs ?? [] }),
    [checkedName, competitions, clubs],
  );
}
