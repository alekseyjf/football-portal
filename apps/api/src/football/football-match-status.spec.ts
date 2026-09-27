import { MatchStatus } from '@prisma/client';
import { isMatchInLiveWindow } from './football-match-status';

const NOW = new Date('2026-09-26T18:00:00Z');
const MINUTE_MS = 60_000;

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MINUTE_MS);
}

describe('isMatchInLiveWindow (P5-11)', () => {
  it('запланований: від «за 15 хв» до «+3 год» від початку', () => {
    const scheduledAt = (minutes: number) =>
      isMatchInLiveWindow(
        { status: MatchStatus.SCHEDULED, kickoffAt: minutesFromNow(minutes) },
        NOW,
      );
    expect(scheduledAt(15)).toBe(true);
    expect(scheduledAt(16)).toBe(false);
    // Почався 2 год тому, а в БД досі SCHEDULED — саме тоді LIVE-синк і потрібен (F10)
    expect(scheduledAt(-120)).toBe(true);
    expect(scheduledAt(-180)).toBe(true);
    expect(scheduledAt(-181)).toBe(false);
  });

  it('гра йде / перервана — у вікні, якщо почалась не давніше 12 год', () => {
    for (const status of [
      MatchStatus.LIVE,
      MatchStatus.PAUSED,
      MatchStatus.SUSPENDED,
    ]) {
      expect(
        isMatchInLiveWindow({ status, kickoffAt: minutesFromNow(-200) }, NOW),
      ).toBe(true);
      expect(
        isMatchInLiveWindow(
          { status, kickoffAt: minutesFromNow(-13 * 60) },
          NOW,
        ),
      ).toBe(false);
    }
  });

  it('завершений / скасований / перенесений — ніколи', () => {
    for (const status of [
      MatchStatus.FINISHED,
      MatchStatus.AWARDED,
      MatchStatus.CANCELLED,
      MatchStatus.POSTPONED,
    ]) {
      expect(isMatchInLiveWindow({ status, kickoffAt: NOW }, NOW)).toBe(false);
    }
  });
});
