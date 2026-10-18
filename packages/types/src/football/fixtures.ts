import type { ApiSchemas } from '../api-schemas';

/** Тур: `(stage, matchday)`; у плей-оф — уся стадія (`matchday: null`, обидва матчі раунду разом). */
export type FixturesRound = ApiSchemas['FixturesRoundDto'];

/**
 * Стадії, що йдуть турами (ліга, ліга-фаза, групи): `matchday` — номер туру. У плей-оф
 * `matchday` не тур (WC — `null`, EC — 4–7), підпис — лише стадія. Як `MATCHDAY_STAGES` в API
 * (стадія — рядок провайдера, у схемі не перелічена, тож тут — копія).
 */
export const MATCHDAY_STAGES: readonly string[] = [
  'REGULAR_SEASON',
  'LEAGUE_STAGE',
  'GROUP_STAGE',
];
