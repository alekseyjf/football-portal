import { MatchStatus } from '@prisma/client';

/** Відповіді football-data.org v4 — лише поля, які читаємо (решта ігноруємо). */
export interface FdArea {
  name?: string;
}

export interface FdSeason {
  id?: number;
  startDate?: string;
  endDate?: string;
}

export interface FdCompetition {
  id: number;
  name: string;
  code?: string;
  type?: string;
  emblem?: string;
  area?: FdArea;
  currentSeason?: FdSeason;
}

export interface FdTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
  founded?: number;
  venue?: string;
}

export interface FdTeamsResponse {
  teams?: FdTeam[];
}

export interface FdScoreSide {
  home?: number | null;
  away?: number | null;
}

export interface FdScore {
  fullTime?: FdScoreSide;
  halfTime?: FdScoreSide;
}

export interface FdMatchSide {
  id: number;
  name: string;
  crest?: string;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  minute?: number | null;
  homeTeam: FdMatchSide;
  awayTeam: FdMatchSide;
  score?: FdScore;
}

export interface FdMatchesResponse {
  matches?: FdMatch[];
}

export interface FdStandingRow {
  position: number;
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  team: FdTeam;
}

export interface FdStanding {
  type?: string;
  table?: FdStandingRow[];
}

export interface FdStandingsResponse {
  standings?: FdStanding[];
}

export function slugifySegment(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'x';
}

/**
 * Slug для URL/БД: код змагання у верхньому регістрі (PL, CL, DED) — як у `/v4/competitions/PL`.
 * Якщо коду немає — стабільний fallback `L{id}`.
 */
export function leagueSlugFromFd(competition: FdCompetition): string {
  const codeRaw = competition.code?.trim();
  if (codeRaw) return codeRaw.toUpperCase();
  return `L${competition.id}`;
}

export function clubSlugFromFd(team: FdTeam): string {
  return `${slugifySegment(team.name)}-${team.id}`;
}

export function seasonLabelFromFd(competition: FdCompetition): string {
  const seasonStartDate = competition.currentSeason?.startDate;
  const seasonEndDate = competition.currentSeason?.endDate;
  if (seasonStartDate && seasonEndDate) {
    return `${seasonStartDate.slice(0, 4)}/${seasonEndDate.slice(0, 4)}`;
  }
  if (seasonStartDate) return seasonStartDate.slice(0, 4);
  return String(new Date().getUTCFullYear());
}

export function mapMatchStatus(apiStatus: string): MatchStatus {
  const matchStatusByApiStatus: Record<string, MatchStatus> = {
    SCHEDULED: MatchStatus.SCHEDULED,
    TIMED: MatchStatus.SCHEDULED,
    IN_PLAY: MatchStatus.LIVE,
    PAUSED: MatchStatus.LIVE,
    EXTRA_TIME: MatchStatus.LIVE,
    PENALTY_SHOOTOUT: MatchStatus.LIVE,
    FINISHED: MatchStatus.FINISHED,
    AWARDED: MatchStatus.FINISHED,
    POSTPONED: MatchStatus.POSTPONED,
    SUSPENDED: MatchStatus.POSTPONED,
    CANCELLED: MatchStatus.CANCELLED,
  };
  return matchStatusByApiStatus[apiStatus] ?? MatchStatus.SCHEDULED;
}
