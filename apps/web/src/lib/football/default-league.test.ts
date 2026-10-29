import { describe, expect, it } from 'vitest';
import type { League } from '@/lib/api/types';
import { resolveDefaultLeagueSlug } from './default-league';

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

describe('Ліга сайдбару головної без ?league= (P5b-2, D55)', () => {
  it('ліга з env «у грі» — вона, навіть якщо не перша', () => {
    const leagues = [league('PL', true), league('BL1', true)];
    expect(resolveDefaultLeagueSlug(leagues, 'BL1')).toBe('BL1');
  });

  it('ліга з env не в грі (ЧС після турніру) — перша «у грі», а не вона й не перша за порядком', () => {
    const leagues = [
      league('WC', false),
      league('PL', true),
      league('CL', true),
    ];
    expect(resolveDefaultLeagueSlug(leagues, 'WC')).toBe('PL');
    expect(resolveDefaultLeagueSlug(leagues, null)).toBe('PL');
  });

  it('не в грі жоден (міжсезоння) — env, якщо ліга активна, інакше перша активна', () => {
    const leagues = [league('PL', false), league('BL1', false)];
    expect(resolveDefaultLeagueSlug(leagues, 'BL1')).toBe('BL1');
    expect(resolveDefaultLeagueSlug(leagues, 'FAC')).toBe('PL');
  });

  it('env з вимкненою лігою (її немає серед активних) за замовчуванням не відкривається', () => {
    expect(resolveDefaultLeagueSlug([league('PL', true)], 'EC')).toBe('PL');
  });

  it('активних немає — null; список не завантажився (API недоступне) — env як є', () => {
    expect(resolveDefaultLeagueSlug([], 'PL')).toBeNull();
    expect(resolveDefaultLeagueSlug(null, 'PL')).toBe('PL');
    expect(resolveDefaultLeagueSlug(null, null)).toBeNull();
  });
});
