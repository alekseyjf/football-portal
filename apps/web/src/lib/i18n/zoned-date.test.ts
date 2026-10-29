import { describe, expect, it } from 'vitest';
import {
  dayKeyInTimeZone,
  isDayKey,
  shiftDayKey,
  zonedDayRange,
} from './zoned-date';

const HOUR_MS = 60 * 60 * 1000;

function rangeHours(range: { from: string; to: string }): number {
  return (Date.parse(range.to) - Date.parse(range.from)) / HOUR_MS;
}

describe('zonedDayRange: межі дня в поясі користувача → from / to для API', () => {
  it('звичайний день: північ до півночі за місцевим часом', () => {
    expect(zonedDayRange('2026-10-10', 'Europe/Kyiv')).toEqual({
      from: '2026-10-09T21:00:00.000Z',
      to: '2026-10-10T21:00:00.000Z',
    });
    expect(zonedDayRange('2026-10-10', 'America/New_York')).toEqual({
      from: '2026-10-10T04:00:00.000Z',
      to: '2026-10-11T04:00:00.000Z',
    });
  });

  it.each([
    ['Europe/Kyiv', '2026-03-29', 23],
    ['Europe/Kyiv', '2026-10-25', 25],
    ['America/New_York', '2026-03-08', 23],
    ['America/New_York', '2026-11-01', 25],
  ])('%s, %s — день переходу часу триває %i год', (timeZone, dayKey, hours) => {
    const range = zonedDayRange(dayKey, timeZone);
    expect(rangeHours(range)).toBe(hours);
    expect(dayKeyInTimeZone(new Date(range.from), timeZone)).toBe(dayKey);
  });

  it('літній час умикається опівночі (Сантьяго): дня без 00:00 починається з переходу, а не о 23:00 напередодні', () => {
    // 2026-09-06 00:00 (−04) → 01:00 (−03): північ не існує
    expect(zonedDayRange('2026-09-06', 'America/Santiago')).toEqual({
      from: '2026-09-06T04:00:00.000Z',
      to: '2026-09-07T03:00:00.000Z',
    });
    expect(zonedDayRange('2026-09-05', 'America/Santiago')).toEqual({
      from: '2026-09-05T04:00:00.000Z',
      to: '2026-09-06T04:00:00.000Z',
    });
  });

  it.each([
    'Europe/Kyiv',
    'America/New_York',
    'America/Santiago',
    'Australia/Lord_Howe',
    'Asia/Kolkata',
    'Pacific/Kiritimati',
  ])(
    '%s: 400 днів поспіль — дні стикуються без проміжків і накладань',
    (timeZone) => {
      let dayKey = '2026-01-01';
      let range = zonedDayRange(dayKey, timeZone);
      for (let dayIndex = 0; dayIndex < 400; dayIndex += 1) {
        const nextDayKey = shiftDayKey(dayKey, 1);
        const nextRange = zonedDayRange(nextDayKey, timeZone);
        expect({
          dayKey,
          startsOn: dayKeyInTimeZone(new Date(range.from), timeZone),
        }).toEqual({ dayKey, startsOn: dayKey });
        expect({ dayKey, to: range.to }).toEqual({
          dayKey,
          to: nextRange.from,
        });
        expect(rangeHours(range)).toBeGreaterThanOrEqual(23);
        expect(rangeHours(range)).toBeLessThanOrEqual(25);
        dayKey = nextDayKey;
        range = nextRange;
      }
    },
  );
});

describe('dayKeyInTimeZone', () => {
  it('та сама мить — різні дні в різних поясах', () => {
    const instant = new Date('2026-10-09T22:30:00Z');
    expect(dayKeyInTimeZone(instant, 'Europe/Kyiv')).toBe('2026-10-10');
    expect(dayKeyInTimeZone(instant, 'America/New_York')).toBe('2026-10-09');
    expect(dayKeyInTimeZone(instant, 'UTC')).toBe('2026-10-09');
  });
});

describe('shiftDayKey і isDayKey', () => {
  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2028-02-28', 1, '2028-02-29'],
  ])('%s %+i день → %s', (dayKey, days, expected) => {
    expect(shiftDayKey(dayKey, days)).toBe(expected);
  });

  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-1-1',
    '2026-10-10T00:00',
    'today',
  ])('%s — не день', (value) => {
    expect(isDayKey(value)).toBe(false);
  });

  it('справжня дата, зокрема 29 лютого високосного року', () => {
    expect(isDayKey('2026-10-10')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
  });
});
