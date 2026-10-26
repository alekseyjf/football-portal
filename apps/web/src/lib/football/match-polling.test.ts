import { describe, expect, it } from 'vitest';
import type { MatchStatus } from '@/lib/api/types';
import {
  isMatchesRefetchDue,
  KICKOFF_STATUS_GRACE_MS,
  KICKOFF_TIMER_MAX_MS,
  MATCHES_POLL_INTERVAL_MS,
  matchesRefetchInterval,
} from './match-polling';

const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW = new Date('2026-10-26T18:00:00.000Z');
const NO_JITTER = { now: NOW, jitterMs: 0 };

const match = (status: MatchStatus, minutesFromNow: number) => ({
  status,
  kickoffAt: new Date(NOW.getTime() + minutesFromNow * MINUTE_MS).toISOString(),
});
const minutesAfterNow = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE_MS);

describe('Коли перечитувати матчі (головна й /matches, D55)', () => {
  it('матч у грі (і перерва) — кожні 60 с', () => {
    expect(matchesRefetchInterval([match('LIVE', -30)], NO_JITTER)).toBe(MATCHES_POLL_INTERVAL_MS);
    expect(matchesRefetchInterval([match('PAUSED', -50)], NO_JITTER)).toBe(MATCHES_POLL_INTERVAL_MS);
  });

  it('початок настав, а статус ще «заплановано» — 60 с, але не довше 3 год після початку', () => {
    expect(matchesRefetchInterval([match('SCHEDULED', -5)], NO_JITTER)).toBe(MATCHES_POLL_INTERVAL_MS);
    expect(matchesRefetchInterval([match('SCHEDULED', -KICKOFF_STATUS_GRACE_MS / MINUTE_MS)], NO_JITTER)).toBe(
      MATCHES_POLL_INTERVAL_MS,
    );
    // Застарілі дані (провайдер не оновив матч) — без опитування
    expect(matchesRefetchInterval([match('SCHEDULED', -KICKOFF_STATUS_GRACE_MS / MINUTE_MS - 1)], NO_JITTER)).toBe(
      false,
    );
  });

  it('у грі нічого — один раз у момент найближчого початку, не частіше 60 с', () => {
    expect(
      matchesRefetchInterval([match('FINISHED', -120), match('SCHEDULED', 240), match('SCHEDULED', 90)], NO_JITTER),
    ).toBe(90 * MINUTE_MS);
    expect(matchesRefetchInterval([match('SCHEDULED', 0.25)], NO_JITTER)).toBe(MATCHES_POLL_INTERVAL_MS);
  });

  it('усе скінчилось, перенесено чи скасовано — опитування зупиняється', () => {
    expect(
      matchesRefetchInterval(
        [match('FINISHED', -200), match('POSTPONED', 60), match('CANCELLED', 120), match('AWARDED', -30)],
        NO_JITTER,
      ),
    ).toBe(false);
    expect(matchesRefetchInterval([], NO_JITTER)).toBe(false);
  });
});

describe('Розкид на початку матчу (M1.6.4)', () => {
  it('вкладки з різним розкидом приходять після початку в різні секунди', () => {
    const matches = [match('SCHEDULED', 90)];
    expect(matchesRefetchInterval(matches, { now: NOW, jitterMs: 0 })).toBe(90 * MINUTE_MS);
    expect(matchesRefetchInterval(matches, { now: NOW, jitterMs: 30 * SECOND_MS })).toBe(
      90 * MINUTE_MS + 30 * SECOND_MS,
    );
  });

  it('початок настав, а розкид вкладки — ще ні: чекаємо розкиду, а не опитуємо', () => {
    // Початок 10 хв тому — опитування; розкид 30 с при початку 2 хв тому вже минув — теж
    expect(matchesRefetchInterval([match('SCHEDULED', -2)], { now: NOW, jitterMs: 30 * SECOND_MS })).toBe(
      MATCHES_POLL_INTERVAL_MS,
    );
    // Початок 2 хв тому, розкид — ще 3 хв (з довшим розкидом правило те саме): одне перечитування в його момент
    expect(matchesRefetchInterval([match('SCHEDULED', -2)], { now: NOW, jitterMs: 5 * MINUTE_MS })).toBe(
      3 * MINUTE_MS,
    );
  });
});

describe('Найдовший таймер до початку — 6 год (M1.6.4)', () => {
  it('матч завтра чи за кілька місяців (`/matches?date=`) — таймер не довший за 6 год', () => {
    expect(matchesRefetchInterval([match('SCHEDULED', 24 * 60)], NO_JITTER)).toBe(KICKOFF_TIMER_MAX_MS);
    // Понад 2³¹ − 1 мс браузер спрацював би одразу
    expect(matchesRefetchInterval([match('SCHEDULED', 90 * 24 * 60)], NO_JITTER)).toBe(KICKOFF_TIMER_MAX_MS);
  });

  it('після 6 год таймер планує заново — на решту часу до початку', () => {
    const matches = [match('SCHEDULED', 8 * 60)];
    expect(matchesRefetchInterval(matches, NO_JITTER)).toBe(6 * HOUR_MS);
    expect(matchesRefetchInterval(matches, { now: minutesAfterNow(6 * 60), jitterMs: 0 })).toBe(2 * HOUR_MS);
  });

  it('матч рівно через 6 год — один таймер на весь час', () => {
    expect(matchesRefetchInterval([match('SCHEDULED', 6 * 60)], NO_JITTER)).toBe(6 * HOUR_MS);
  });
});

describe('Повернення у вкладку — чи настав момент перечитати (M1.6.4)', () => {
  const kickoffIn90 = [match('SCHEDULED', 90)];
  const returnAt = (minutes: number, jitterMs = 0) => ({ fetchedAt: NOW, now: minutesAfterNow(minutes), jitterMs });

  it('вкладку сховали до початку, повернулись після — перечитати', () => {
    expect(isMatchesRefetchDue(kickoffIn90, returnAt(95))).toBe(true);
    expect(isMatchesRefetchDue(kickoffIn90, returnAt(90))).toBe(true);
  });

  it('повернулись до початку чи до розкиду вкладки — не перечитувати, чекати таймера', () => {
    expect(isMatchesRefetchDue(kickoffIn90, returnAt(60))).toBe(false);
    expect(isMatchesRefetchDue(kickoffIn90, returnAt(90.25, 30 * SECOND_MS))).toBe(false);
    expect(isMatchesRefetchDue(kickoffIn90, returnAt(90.5, 30 * SECOND_MS))).toBe(true);
  });

  it('матч у грі — перечитати, якщо з останнього завантаження минуло 60 с', () => {
    const live = [match('LIVE', -30)];
    expect(isMatchesRefetchDue(live, returnAt(0.5))).toBe(false);
    expect(isMatchesRefetchDue(live, returnAt(1))).toBe(true);
  });

  it('попереду нічого — повернення у вкладку матчі не перечитує', () => {
    expect(isMatchesRefetchDue([match('FINISHED', -120)], returnAt(24 * 60))).toBe(false);
  });

  it('матч за тиждень, вкладка прихована понад 6 год — перечитати (пропущений крок таймера)', () => {
    const nextWeek = [match('SCHEDULED', 7 * 24 * 60)];
    expect(isMatchesRefetchDue(nextWeek, returnAt(5 * 60))).toBe(false);
    expect(isMatchesRefetchDue(nextWeek, returnAt(7 * 60))).toBe(true);
  });
});
