import type { League } from '@/lib/api/types';

/**
 * Турніри для вибору ліги — вкладки стрічки `/news` (M1.6.1) і перемикач сайдбару головної (M1.6.3): «у грі» (D48)
 * у порядку редакції — і вибраний, навіть якщо він не в грі (новини ЧС після турніру): увімкнений — на своєму місці,
 * вимкнений — останнім. Невідомий турнір у списку не з'являється.
 *
 * @param activeLeagues увімкнені турніри за `sortOrder` (`GET /football/leagues`)
 * @param selectedLeague вибраний турнір, якого серед увімкнених немає (`GET /football/leagues/{slug}` чи `league`
 *   дашборду); є серед увімкнених — не повторюється
 */
export function inPlayLeaguesWithSelected(
  activeLeagues: League[],
  selectedSlug: string | null,
  selectedLeague: League | null,
): League[] {
  const leagues = activeLeagues.filter(
    (league) => league.isInPlay || league.slug === selectedSlug,
  );
  if (
    selectedLeague &&
    !leagues.some((league) => league.slug === selectedLeague.slug)
  ) {
    leagues.push(selectedLeague);
  }
  return leagues;
}
