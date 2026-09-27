/**
 * `?season=` у URL (P5-16): `2025-26` для сезону через рік, `2026` — у межах року.
 * У БД label з `/` (`2025/26`) — у query-рядку він незручний, тому `-`.
 */
export const SEASON_PARAM_PATTERN = /^\d{4}(-\d{2})?$/;

export function seasonLabelFromParam(seasonParam: string): string {
  return seasonParam.replace('-', '/');
}
