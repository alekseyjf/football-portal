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

/** Турнір-чип (D47): у новині для адмінки (`GET /posts/admin/{id}`) і серед турнірів «у грі» клубу в пошуку (D48). */
export type CompetitionRef = ApiSchemas['CompetitionRefDto'];
