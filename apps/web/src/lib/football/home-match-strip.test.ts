import { describe, expect, it } from 'vitest';
import type { League, MatchListItem, MatchStatus } from '@/lib/api/types';
import {
  HOME_STRIP_MAX_MATCHES,
  homeStripMatches,
  matchStripDayOf,
} from './home-match-strip';

const LEAGUE_NAMES: Record<string, string> = {
  PL: 'Premier League',
  CL: 'UEFA Champions League',
  BL1: 'Bundesliga',
  EC: 'European Championship',
  FAC: 'FA Cup',
};

function league(slug: string): League {
  return {
    id: `competition-${slug}`,
    slug,
    name: LEAGUE_NAMES[slug],
    type: 'LEAGUE',
    emblemUrl: null,
    area: null,
    currentSeason: null,
    isInPlay: true,
  };
}

const club = (slug: string) => ({
  id: `club-${slug}`,
  slug,
  name: slug,
  shortName: null,
  tla: null,
  crestUrl: null,
});

function match(
  id: string,
  leagueSlug: string,
  status: MatchStatus,
  kickoffAt: string,
): MatchListItem {
  return {
    id,
    status,
    kickoffAt,
    minute: null,
    matchday: 10,
    stage: 'REGULAR_SEASON',
    groupName: null,
    homeScore: null,
    awayScore: null,
    homeClub: club(`${id}-home`),
    awayClub: club(`${id}-away`),
    league: {
      id: `competition-${leagueSlug}`,
      slug: leagueSlug,
      name: LEAGUE_NAMES[leagueSlug],
      type: 'LEAGUE',
      emblemUrl: null,
    },
  };
}

// Порядок перемикача (`sortOrder`): PL → CL → BL1; EC і FAC серед увімкнених немає
const ORDERED_LEAGUES = [league('PL'), league('CL'), league('BL1')];

describe('Стрічка матчів головної: порядок і межа (D55)', () => {
  it('турнір (порядок перемикача) → статус (іде → попереду → завершився → перенесений / скасований) → час', () => {
    const matches = [
      match('bl-finished', 'BL1', 'FINISHED', '2026-10-26T13:30:00.000Z'),
      match('pl-postponed', 'PL', 'POSTPONED', '2026-10-26T12:00:00.000Z'),
      match('pl-late', 'PL', 'SCHEDULED', '2026-10-26T19:00:00.000Z'),
      match('cl-live', 'CL', 'LIVE', '2026-10-26T17:45:00.000Z'),
      match('pl-early', 'PL', 'SCHEDULED', '2026-10-26T15:00:00.000Z'),
      match('pl-finished', 'PL', 'FINISHED', '2026-10-26T11:30:00.000Z'),
      match('pl-halftime', 'PL', 'PAUSED', '2026-10-26T14:00:00.000Z'),
      match('pl-cancelled', 'PL', 'CANCELLED', '2026-10-26T10:00:00.000Z'),
      match('pl-live', 'PL', 'LIVE', '2026-10-26T14:30:00.000Z'),
    ];

    expect(
      homeStripMatches(matches, ORDERED_LEAGUES).map((item) => item.id),
    ).toEqual([
      'pl-halftime',
      'pl-live',
      'pl-early',
      'pl-late',
      'pl-finished',
      'pl-cancelled',
      'pl-postponed',
      'cl-live',
      'bl-finished',
    ]);
  });

  it('турніри поза перемикачем — після всіх, за назвою', () => {
    const matches = [
      match('fa-cup', 'FAC', 'SCHEDULED', '2026-10-26T12:00:00.000Z'),
      match('euro', 'EC', 'SCHEDULED', '2026-10-26T11:00:00.000Z'),
      match('bundesliga', 'BL1', 'SCHEDULED', '2026-10-26T20:00:00.000Z'),
    ];
    expect(
      homeStripMatches(matches, ORDERED_LEAGUES).map((item) => item.id),
    ).toEqual(['bundesliga', 'euro', 'fa-cup']);
  });

  it('у розмітці — не більше 40: першими лишаються турніри перемикача; масив API не змінюється', () => {
    const matches = Array.from({ length: 45 }, (_, index) =>
      match(
        `m${String(index).padStart(2, '0')}`,
        index < 5 ? 'BL1' : 'PL',
        'SCHEDULED',
        '2026-10-26T15:00:00.000Z',
      ),
    );
    const firstId = matches[0].id;

    const strip = homeStripMatches(matches, ORDERED_LEAGUES);

    expect(strip).toHaveLength(HOME_STRIP_MAX_MATCHES);
    expect(strip.every((item) => item.league.slug === 'PL')).toBe(true);
    expect(matches[0].id).toBe(firstId);
  });
});

describe('День стрічки в поясі читача (🧭 п. 3)', () => {
  // 26.10.2026 22:30 UTC: у Києві (UTC+2 з 25 жовтня) — уже 00:30 27-го, у Нью-Йорку (UTC−4) — ще 18:30 26-го
  const nearKyivMidnight = new Date('2026-10-26T22:30:00.000Z');

  it('та сама мить біля півночі — різні дні й межі в Києві й Нью-Йорку', () => {
    expect(matchStripDayOf(nearKyivMidnight, 'Europe/Kyiv')).toEqual({
      dayKey: '2026-10-27',
      from: '2026-10-26T22:00:00.000Z',
      to: '2026-10-27T22:00:00.000Z',
    });
    expect(matchStripDayOf(nearKyivMidnight, 'America/New_York')).toEqual({
      dayKey: '2026-10-26',
      from: '2026-10-26T04:00:00.000Z',
      to: '2026-10-27T04:00:00.000Z',
    });
  });

  it('найближчий матч о 05:30 за Києвом — для Нью-Йорка це ще той самий вечір', () => {
    const kickoffAt = new Date('2026-10-27T03:30:00.000Z');
    expect(matchStripDayOf(kickoffAt, 'Europe/Kyiv').dayKey).toBe('2026-10-27');
    expect(matchStripDayOf(kickoffAt, 'America/New_York').dayKey).toBe(
      '2026-10-26',
    );
  });
});
