import { describe, expect, it } from 'vitest';
import { matchesSearchPage, parseMatchesPageParams } from './matches-page';

describe('Адреса `/matches` (M1.8.1)', () => {
  it('день і ліга з адреси; невалідні — `null`: сторінка покаже сьогодні й усі турніри', () => {
    expect(
      parseMatchesPageParams({ date: '2026-10-30', league: 'PL' }),
    ).toEqual({ dayKey: '2026-10-30', leagueSlug: 'PL' });
    expect(
      parseMatchesPageParams({ date: '2026-02-30', league: 'premier league' }),
    ).toEqual({ dayKey: null, leagueSlug: null });
    expect(
      parseMatchesPageParams({ date: ['2026-10-30', '2026-10-31'] }),
    ).toEqual({ dayKey: '2026-10-30', leagueSlug: null });
  });

  it('без параметрів — в індексі; `utm_*` у canonical не потрапляють', () => {
    expect(matchesSearchPage({ utm_source: 'telegram' })).toEqual({
      href: { pathname: '/matches', query: {} },
      isIndexable: true,
    });
  });

  it('день чи ліга — `noindex`, canonical на себе: лише розібрані параметри', () => {
    expect(matchesSearchPage({ date: '2026-10-30', league: 'PL' })).toEqual({
      href: {
        pathname: '/matches',
        query: { date: '2026-10-30', league: 'PL' },
      },
      isIndexable: false,
    });
    expect(matchesSearchPage({ league: 'CL' }).isIndexable).toBe(false);
  });

  it('невалідна дата — це сторінка без параметрів, вона в індексі', () => {
    expect(matchesSearchPage({ date: 'yesterday' })).toEqual({
      href: { pathname: '/matches', query: {} },
      isIndexable: true,
    });
  });
});
