import type { League } from '@/lib/api/types';

/**
 * Вкладки ліг стрічки (M1.6.1): турніри «у грі» (D48) у порядку редакції — і вибраний з адреси, навіть якщо він не в
 * грі (новини ЧС після турніру): увімкнений — на своєму місці, вимкнений — останнім. Невідомий турнір вкладки не має.
 *
 * @param activeLeagues увімкнені турніри за `sortOrder` (`GET /football/leagues`)
 * @param selectedLeague вибраний турнір, якого серед увімкнених немає (`GET /football/leagues/{slug}`)
 */
export function newsFeedLeagueTabs(
  activeLeagues: League[],
  selectedSlug: string | null,
  selectedLeague: League | null,
): League[] {
  const tabs = activeLeagues.filter(
    (league) => league.isInPlay || league.slug === selectedSlug,
  );
  if (selectedLeague && !tabs.some((tab) => tab.slug === selectedLeague.slug)) {
    tabs.push(selectedLeague);
  }
  return tabs;
}
