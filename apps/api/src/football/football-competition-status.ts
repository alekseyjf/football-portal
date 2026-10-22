import type { Prisma } from '@prisma/client';
import { DAY_MS } from './football.constants';
import { FINAL_MATCH_STATUSES } from './football-match-status';

/** Турнір і його сезон — усе, з чого видно, чи турнір «у грі». */
export interface CompetitionSeasonState {
  /** Турнір увімкнено редакцією (`Competition.isActive`) */
  isActive: boolean;
  /** Сезон — поточний у турніру (`Season.isCurrent`) */
  isCurrent: boolean;
  /** Останній день сезону за провайдером (`Season.endDate`, `@db.Date` — північ UTC цього дня) */
  endDate: Date;
  /** Матчів сезону, що ще попереду (`pendingMatchWhere`) */
  pendingMatchCount: number;
}

/**
 * Матч ще попереду (D48): статус не остаточний і початок — не давніше `graceDays` днів тому. Не остаточний
 * матч, що мав відбутися давніше, — застарілі дані (перенесений без нової дати, не оновлений провайдером):
 * турнір «у грі» він не тримає. Умова — для лічильника в БД.
 */
export function pendingMatchWhere(
  now: Date,
  graceDays: number,
): Prisma.MatchWhereInput {
  return {
    status: { notIn: [...FINAL_MATCH_STATUSES] },
    kickoffAt: { gte: new Date(now.getTime() - graceDays * DAY_MS) },
  };
}

/**
 * Турнір «зараз у грі» (D48): увімкнений, сезон поточний і ще не скінчився — є матчі, що ще попереду, або від
 * кінця останнього дня сезону минуло не більше `graceDays` днів. Самого `isCurrent` мало: у WC 2026 і EC 2024
 * він тримається, доки провайдер не заведе наступний турнір. Правило — для підказок і показу, не для cron синку (M1.11.7).
 */
export function isCompetitionInPlay(
  competitionSeason: CompetitionSeasonState,
  now: Date,
  graceDays: number,
): boolean {
  if (!competitionSeason.isActive || !competitionSeason.isCurrent) {
    return false;
  }
  if (competitionSeason.pendingMatchCount > 0) return true;
  const seasonEndsAt = competitionSeason.endDate.getTime() + DAY_MS;
  return seasonEndsAt + graceDays * DAY_MS >= now.getTime();
}
