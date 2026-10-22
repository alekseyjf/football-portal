import { MatchStatus } from '@prisma/client';
import {
  isCompetitionInPlay,
  pendingMatchWhere,
  type CompetitionSeasonState,
} from './football-competition-status';
import { COMPETITION_IN_PLAY_GRACE_DAYS, DAY_MS } from './football.constants';

const OCTOBER_2026 = '2026-10-22T12:00:00Z';

/** Увімкнений турнір і його поточний сезон — як усі 9 турнірів dev-БД. */
function currentSeason(
  endDate: string,
  pendingMatchCount: number,
): CompetitionSeasonState {
  return {
    isActive: true,
    isCurrent: true,
    endDate: new Date(endDate),
    pendingMatchCount,
  };
}

function isInPlayAt(
  competitionSeason: CompetitionSeasonState,
  now: string | number,
): boolean {
  return isCompetitionInPlay(
    competitionSeason,
    new Date(now),
    COMPETITION_IN_PLAY_GRACE_DAYS,
  );
}

describe('isCompetitionInPlay (D48)', () => {
  const worldCup2026 = currentSeason('2026-07-19', 0);
  const euro2024 = currentSeason('2024-07-14', 0);
  // Ліга-фазу зіграно, матчів плей-оф у БД ще немає: `endDate` сезону — кінець ліга-фази
  const championsLeagueAfterLeaguePhase = currentSeason('2027-01-27', 0);

  it('сезон поточний, але турнір скінчився — ні: WC 2026 у жовтні, EC 2024', () => {
    expect(isInPlayAt(worldCup2026, OCTOBER_2026)).toBe(false);
    expect(isInPlayAt(euro2024, OCTOBER_2026)).toBe(false);
  });

  it('CL 10.02 без матчів плей-оф — так: від кінця ліга-фази не минув запас', () => {
    expect(
      isInPlayAt(championsLeagueAfterLeaguePhase, '2027-02-10T12:00:00Z'),
    ).toBe(true);
  });

  it('є матчі попереду — так, і після запасу: плей-оф CL уже в БД, а endDate — ще ліга-фази', () => {
    expect(
      isInPlayAt(currentSeason('2027-01-27', 16), '2027-03-10T12:00:00Z'),
    ).toBe(true);
    expect(isInPlayAt(currentSeason('2027-05-30', 311), OCTOBER_2026)).toBe(
      true,
    );
  });

  it(`запас — ${COMPETITION_IN_PLAY_GRACE_DAYS} днів від кінця останнього дня сезону, межа включно`, () => {
    // Фінал WC 2026 — увечері 19.07: день закінчення рахується повністю
    const graceEndsAt =
      new Date('2026-07-20').getTime() +
      COMPETITION_IN_PLAY_GRACE_DAYS * DAY_MS;
    expect(isInPlayAt(worldCup2026, graceEndsAt)).toBe(true);
    expect(isInPlayAt(worldCup2026, graceEndsAt + 1)).toBe(false);
  });

  it('неактивний турнір чи не поточний сезон — ні, навіть з матчами попереду', () => {
    const leagueMidSeason = currentSeason('2027-05-30', 311);
    expect(
      isInPlayAt({ ...leagueMidSeason, isActive: false }, OCTOBER_2026),
    ).toBe(false);
    expect(
      isInPlayAt({ ...leagueMidSeason, isCurrent: false }, OCTOBER_2026),
    ).toBe(false);
  });
});

describe('pendingMatchWhere (D48)', () => {
  it('матч попереду — статус не остаточний і початок не давніше запасу: давній незіграний — застарілі дані', () => {
    const now = new Date(OCTOBER_2026);
    expect(pendingMatchWhere(now, COMPETITION_IN_PLAY_GRACE_DAYS)).toEqual({
      status: {
        notIn: [
          MatchStatus.FINISHED,
          MatchStatus.AWARDED,
          MatchStatus.CANCELLED,
        ],
      },
      kickoffAt: { gte: new Date('2026-09-22T12:00:00Z') },
    });
  });
});
