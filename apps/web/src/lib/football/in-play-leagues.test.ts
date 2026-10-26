import { describe, expect, it } from 'vitest';
import type { League } from '@/lib/api/types';
import { inPlayLeaguesWithSelected } from './in-play-leagues';

function league(slug: string, isInPlay: boolean): League {
  return {
    id: `competition-${slug}`,
    slug,
    name: slug,
    type: 'LEAGUE',
    emblemUrl: null,
    area: null,
    currentSeason: null,
    isInPlay,
  };
}

// Увімкнені турніри в порядку редакції: ЧС 2026 у жовтні — поточний сезон, але не «у грі»
const ACTIVE_LEAGUES = [
  league('PL', true),
  league('WC', false),
  league('CL', true),
];

function tabSlugs(selectedSlug: string | null, selectedLeague: League | null = null) {
  return inPlayLeaguesWithSelected(ACTIVE_LEAGUES, selectedSlug, selectedLeague).map(
    (tab) => tab.slug,
  );
}

describe('Турніри вкладок стрічки й перемикача головної (M1.6.1, M1.6.3)', () => {
  it('без вибору — лише турніри «у грі», у порядку редакції', () => {
    expect(tabSlugs(null)).toEqual(['PL', 'CL']);
  });

  it('вибраний увімкнений, але не «у грі», — на своєму місці', () => {
    expect(tabSlugs('WC')).toEqual(['PL', 'WC', 'CL']);
  });

  it('вибраний вимкнений (його дав `GET /football/leagues/{slug}`) — останнім', () => {
    expect(tabSlugs('EC', league('EC', false))).toEqual(['PL', 'CL', 'EC']);
  });

  it('вибраний «у грі» — без повтору; невідомий турнір — без вкладки', () => {
    expect(tabSlugs('PL', league('PL', true))).toEqual(['PL', 'CL']);
    expect(tabSlugs('XX')).toEqual(['PL', 'CL']);
  });
});
