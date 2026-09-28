/**
 * Інтервал `GET /football/matches` (🧭 п. 3, п. 6 плану): `from` — включно, `to` — ні.
 * 31 доба + запас: місяць у поясі користувача через перехід на літній / зимовий час
 * буває на годину довшим за 31 × 24 год.
 */
export const MATCH_RANGE_MAX_MS = 32 * 24 * 60 * 60_000;

/** Страховка від величезних відповідей: за 31 день у 9 турнірах — кілька сотень матчів. */
export const MATCH_RANGE_MAX_ROWS = 1000;

export type MatchRangeErrorCode =
  | 'MATCH_RANGE_INVALID'
  | 'MATCH_RANGE_TOO_LONG';

export type MatchRangeResult =
  | { isValid: true; from: Date; to: Date }
  | { isValid: false; errorCode: MatchRangeErrorCode };

export function parseMatchRange(
  fromIso: string,
  toIso: string,
): MatchRangeResult {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to.getTime() <= from.getTime()
  ) {
    return { isValid: false, errorCode: 'MATCH_RANGE_INVALID' };
  }
  if (to.getTime() - from.getTime() > MATCH_RANGE_MAX_MS) {
    return { isValid: false, errorCode: 'MATCH_RANGE_TOO_LONG' };
  }
  return { isValid: true, from, to };
}

/** `PL,CL,PL` → `['PL', 'CL']`; без параметра — `null` (тоді лише активні турніри). */
export function leagueSlugsFromParam(
  leagueParam: string | undefined,
): string[] | null {
  if (!leagueParam) return null;
  return [...new Set(leagueParam.split(','))];
}
