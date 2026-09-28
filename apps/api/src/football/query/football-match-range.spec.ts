import {
  leagueSlugsFromParam,
  MATCH_RANGE_MAX_MS,
  parseMatchRange,
} from './football-match-range';

describe('parseMatchRange', () => {
  it('день у Києві (UTC+3): межі — миттєвості з поясом', () => {
    const range = parseMatchRange(
      '2026-10-10T00:00:00+03:00',
      '2026-10-11T00:00:00+03:00',
    );

    expect(range).toEqual({
      isValid: true,
      from: new Date('2026-10-09T21:00:00Z'),
      to: new Date('2026-10-10T21:00:00Z'),
    });
  });

  it('to ≤ from → MATCH_RANGE_INVALID', () => {
    expect(
      parseMatchRange('2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z'),
    ).toEqual({ isValid: false, errorCode: 'MATCH_RANGE_INVALID' });
    expect(
      parseMatchRange('2026-10-11T00:00:00Z', '2026-10-10T00:00:00Z'),
    ).toEqual({ isValid: false, errorCode: 'MATCH_RANGE_INVALID' });
  });

  it('неіснуюча дата → MATCH_RANGE_INVALID', () => {
    expect(
      parseMatchRange('2026-13-40T00:00:00Z', '2026-10-10T00:00:00Z'),
    ).toEqual({ isValid: false, errorCode: 'MATCH_RANGE_INVALID' });
  });

  it('місяць через перехід на зимовий час (31 доба + 1 год) — дозволено, понад 32 доби — ні', () => {
    expect(
      parseMatchRange('2026-10-01T00:00:00+03:00', '2026-11-01T00:00:00+02:00')
        .isValid,
    ).toBe(true);

    const from = new Date('2026-10-01T00:00:00Z');
    const tooLate = new Date(from.getTime() + MATCH_RANGE_MAX_MS + 1);
    expect(parseMatchRange(from.toISOString(), tooLate.toISOString())).toEqual({
      isValid: false,
      errorCode: 'MATCH_RANGE_TOO_LONG',
    });
  });
});

describe('leagueSlugsFromParam', () => {
  it('без параметра — null (лише активні турніри)', () => {
    expect(leagueSlugsFromParam(undefined)).toBeNull();
    expect(leagueSlugsFromParam('')).toBeNull();
  });

  it('дублікати прибрано, порядок збережено', () => {
    expect(leagueSlugsFromParam('PL,CL,PL')).toEqual(['PL', 'CL']);
  });
});
