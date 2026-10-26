import { describe, expect, it } from 'vitest';
import type { MatchStatus } from '@/lib/api/types';
import {
  KICKOFF_STATUS_GRACE_MS,
  MATCHES_POLL_INTERVAL_MS,
  matchesRefetchInterval,
} from './match-polling';

const MINUTE_MS = 60_000;
const NOW = new Date('2026-10-26T18:00:00.000Z');

const match = (status: MatchStatus, minutesFromNow: number) => ({
  status,
  kickoffAt: new Date(NOW.getTime() + minutesFromNow * MINUTE_MS).toISOString(),
});

describe('Коли перечитувати матчі (головна й /matches, D55)', () => {
  it('матч у грі (і перерва) — кожні 60 с', () => {
    expect(matchesRefetchInterval([match('LIVE', -30)], NOW)).toBe(MATCHES_POLL_INTERVAL_MS);
    expect(matchesRefetchInterval([match('PAUSED', -50)], NOW)).toBe(MATCHES_POLL_INTERVAL_MS);
  });

  it('початок настав, а статус ще «заплановано» — 60 с, але не довше 3 год після початку', () => {
    expect(matchesRefetchInterval([match('SCHEDULED', -5)], NOW)).toBe(MATCHES_POLL_INTERVAL_MS);
    expect(matchesRefetchInterval([match('SCHEDULED', -KICKOFF_STATUS_GRACE_MS / MINUTE_MS)], NOW)).toBe(
      MATCHES_POLL_INTERVAL_MS,
    );
    // Застарілі дані (провайдер не оновив матч) — без опитування
    expect(matchesRefetchInterval([match('SCHEDULED', -KICKOFF_STATUS_GRACE_MS / MINUTE_MS - 1)], NOW)).toBe(false);
  });

  it('у грі нічого — один раз у момент найближчого початку, не частіше 60 с', () => {
    expect(matchesRefetchInterval([match('FINISHED', -120), match('SCHEDULED', 240), match('SCHEDULED', 90)], NOW)).toBe(
      90 * MINUTE_MS,
    );
    expect(matchesRefetchInterval([match('SCHEDULED', 0.25)], NOW)).toBe(MATCHES_POLL_INTERVAL_MS);
  });

  it('усе скінчилось, перенесено чи скасовано — опитування зупиняється', () => {
    expect(
      matchesRefetchInterval([match('FINISHED', -200), match('POSTPONED', 60), match('CANCELLED', 120), match('AWARDED', -30)], NOW),
    ).toBe(false);
    expect(matchesRefetchInterval([], NOW)).toBe(false);
  });

  it('матч за кілька місяців (день у `/matches?date=`) — затримка не довша за межу таймера браузера', () => {
    const interval = matchesRefetchInterval([match('SCHEDULED', 90 * 24 * 60)], NOW);
    expect(interval).toBe(2 ** 31 - 1);
  });
});
