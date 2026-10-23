import type { ApiSchemas } from '../api-schemas';

/** `LEAGUE` — ліга, `CUP` — кубок (ліга-фаза, групи, плей-оф). */
export type CompetitionType = ApiSchemas['CompetitionType'];

/**
 * Турнір з країною й поточним сезоном: `GET /football/leagues` (лише активні, за `sortOrder`),
 * `/football/leagues/{slug}`.
 */
export type League = ApiSchemas['LeagueDto'];

/** Турнір для адмінки — `GET /football/leagues/admin/all`: усі, і вимкнені, у порядку редакції (D48). */
export type AdminLeague = ApiSchemas['AdminLeagueDto'];
