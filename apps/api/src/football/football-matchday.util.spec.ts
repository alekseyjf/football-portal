import {
  groupMatchesIntoRounds,
  type MatchRound,
} from './football-matchday.util';

type TestMatch = {
  id: string;
  stage: string;
  matchday: number | null;
  kickoffAt: Date;
};

function testMatch(
  id: string,
  stage: string,
  matchday: number | null,
  kickoffIso: string,
): TestMatch {
  return { id, stage, matchday, kickoffAt: new Date(kickoffIso) };
}

function describeRounds(rounds: MatchRound<TestMatch>[]) {
  return rounds.map((round) => [
    round.stage,
    round.matchday,
    round.matches.map((match) => match.id),
  ]);
}

describe('groupMatchesIntoRounds', () => {
  it('ліга: тури за номером; перенесений матч лишається у своєму турі; без туру — в кінці', () => {
    // Порядок з БД: matchday asc, kickoffAt asc (NULLS LAST)
    const upcoming = [
      testMatch('md3-postponed', 'REGULAR_SEASON', 3, '2026-12-02T20:00:00Z'),
      testMatch('md6-a', 'REGULAR_SEASON', 6, '2026-10-10T14:00:00Z'),
      testMatch('md6-b', 'REGULAR_SEASON', 6, '2026-10-11T14:00:00Z'),
      testMatch('md7-a', 'REGULAR_SEASON', 7, '2026-10-17T14:00:00Z'),
      testMatch('no-md', 'REGULAR_SEASON', null, '2026-10-20T14:00:00Z'),
    ];
    expect(describeRounds(groupMatchesIntoRounds(upcoming, 'asc'))).toEqual([
      ['REGULAR_SEASON', 3, ['md3-postponed']],
      ['REGULAR_SEASON', 6, ['md6-a', 'md6-b']],
      ['REGULAR_SEASON', 7, ['md7-a']],
      ['REGULAR_SEASON', null, ['no-md']],
    ]);

    // Минулі: останні тури першими, без туру — на початку (як і раніше)
    const past = [
      testMatch('no-md', 'REGULAR_SEASON', null, '2026-09-01T14:00:00Z'),
      testMatch('md5', 'REGULAR_SEASON', 5, '2026-09-20T14:00:00Z'),
      testMatch('md4', 'REGULAR_SEASON', 4, '2026-09-13T14:00:00Z'),
    ];
    expect(describeRounds(groupMatchesIntoRounds(past, 'desc'))).toEqual([
      ['REGULAR_SEASON', null, ['no-md']],
      ['REGULAR_SEASON', 5, ['md5']],
      ['REGULAR_SEASON', 4, ['md4']],
    ]);
  });

  it('WC: плей-оф з matchday null — окремий тур на кожну стадію, від фіналу до групового етапу', () => {
    // Порядок з БД для минулих: matchday desc (NULLS FIRST), kickoffAt desc
    const past = [
      testMatch('final', 'FINAL', null, '2026-07-19T16:00:00Z'),
      testMatch('third', 'THIRD_PLACE', null, '2026-07-18T18:00:00Z'),
      testMatch('sf-2', 'SEMI_FINALS', null, '2026-07-15T16:00:00Z'),
      testMatch('sf-1', 'SEMI_FINALS', null, '2026-07-14T16:00:00Z'),
      testMatch('qf-1', 'QUARTER_FINALS', null, '2026-07-11T22:00:00Z'),
      testMatch('r16-1', 'LAST_16', null, '2026-07-07T17:00:00Z'),
      testMatch('r32-1', 'LAST_32', null, '2026-07-03T22:30:00Z'),
      testMatch('group-md3', 'GROUP_STAGE', 3, '2026-06-27T23:00:00Z'),
      testMatch('group-md2', 'GROUP_STAGE', 2, '2026-06-22T20:00:00Z'),
    ];
    expect(describeRounds(groupMatchesIntoRounds(past, 'desc'))).toEqual([
      ['FINAL', null, ['final']],
      ['THIRD_PLACE', null, ['third']],
      ['SEMI_FINALS', null, ['sf-2', 'sf-1']],
      ['QUARTER_FINALS', null, ['qf-1']],
      ['LAST_16', null, ['r16-1']],
      ['LAST_32', null, ['r32-1']],
      ['GROUP_STAGE', 3, ['group-md3']],
      ['GROUP_STAGE', 2, ['group-md2']],
    ]);
  });

  it('EC: matchday плей-оф (4–7) — не тур: у раунді плей-оф matchday = null', () => {
    const past = [
      testMatch('final', 'FINAL', 7, '2024-07-14T19:00:00Z'),
      testMatch('sf', 'SEMI_FINALS', 6, '2024-07-10T19:00:00Z'),
      testMatch('r16', 'LAST_16', 4, '2024-07-02T19:00:00Z'),
      testMatch('group-md3', 'GROUP_STAGE', 3, '2024-06-26T19:00:00Z'),
    ];
    expect(describeRounds(groupMatchesIntoRounds(past, 'desc'))).toEqual([
      ['FINAL', null, ['final']],
      ['SEMI_FINALS', null, ['sf']],
      ['LAST_16', null, ['r16']],
      ['GROUP_STAGE', 3, ['group-md3']],
    ]);
  });

  it('кубок: стадії за часом, навіть якщо нумерація турів плей-оф починається знову з 1; обидва матчі раунду — один тур', () => {
    // matchday asc перемішує стадії: 1 (група), 1 (плей-оф, перший матч), 2 …
    const upcoming = [
      testMatch('group-md1', 'LEAGUE_STAGE', 1, '2026-09-16T19:00:00Z'),
      testMatch('ko-leg1', 'LAST_16', 1, '2027-03-02T20:00:00Z'),
      testMatch('group-md2', 'LEAGUE_STAGE', 2, '2026-09-30T19:00:00Z'),
      testMatch('ko-leg2', 'LAST_16', 2, '2027-03-10T20:00:00Z'),
    ];
    expect(describeRounds(groupMatchesIntoRounds(upcoming, 'asc'))).toEqual([
      ['LEAGUE_STAGE', 1, ['group-md1']],
      ['LEAGUE_STAGE', 2, ['group-md2']],
      ['LAST_16', null, ['ko-leg1', 'ko-leg2']],
    ]);
  });

  it('порожній список — порожні тури', () => {
    expect(groupMatchesIntoRounds([], 'asc')).toEqual([]);
  });
});
