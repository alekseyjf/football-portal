/**
 * Відповіді football-data.org v4 — лише поля, які читаємо (звірено з реальними відповідями
 * 2026-09-26, план 5.1). Префікс `Fd` — правило 11 CLAUDE.md.
 */

export interface FdArea {
  id?: number;
  name?: string | null;
  code?: string | null;
  flag?: string | null;
}

export interface FdSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday?: number | null;
}

export interface FdCompetitionRef {
  id: number;
  code?: string | null;
}

export interface FdCompetition extends FdCompetitionRef {
  name: string;
  emblem?: string | null;
  area?: FdArea | null;
  currentSeason?: FdSeason | null;
}

/** Команда в матчі / таблиці. `id: null` — учасник плей-оф ще не визначений. */
export interface FdTeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface FdTeam extends FdTeamRef {
  area?: FdArea | null;
  founded?: number | null;
  venue?: string | null;
  website?: string | null;
  clubColors?: string | null;
}

export interface FdTeamsResponse {
  competition?: FdCompetitionRef | null;
  season?: FdSeason | null;
  teams?: FdTeam[];
}

export interface FdScoreSide {
  home?: number | null;
  away?: number | null;
}

/**
 * ⚠️ `fullTime` у матчі з серією пенальті **містить** голи серії (F2):
 * GER–PAR `fullTime 4:5` = `regularTime 1:1` + `extraTime 0:0` + `penalties 3:4`.
 */
export interface FdScore {
  winner?: string | null;
  duration?: string | null;
  fullTime?: FdScoreSide | null;
  halfTime?: FdScoreSide | null;
  regularTime?: FdScoreSide | null;
  extraTime?: FdScoreSide | null;
  penalties?: FdScoreSide | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  /** Лише в LIVE; буває числом або рядком */
  minute?: number | string | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  season?: { id: number } | null;
  venue?: string | null;
  homeTeam: FdTeamRef;
  awayTeam: FdTeamRef;
  score?: FdScore | null;
}

export interface FdMatchesResponse {
  matches?: FdMatch[];
}

export interface FdStandingRow {
  position: number;
  team: FdTeamRef;
  playedGames?: number | null;
  form?: string | null;
  won?: number | null;
  draw?: number | null;
  lost?: number | null;
  points?: number | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  goalDifference?: number | null;
}

/** `group` для ліг — підпис, а не група: PL `"Matchday"`, CL `"League phase"` (F3). */
export interface FdStanding {
  stage?: string | null;
  type?: string | null;
  group?: string | null;
  table?: FdStandingRow[];
}

export interface FdStandingsResponse {
  season?: FdSeason | null;
  standings?: FdStanding[];
}
