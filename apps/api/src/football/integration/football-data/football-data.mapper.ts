import {
  ClubKind,
  MatchStatus,
  MatchWinner,
  StandingType,
} from '@prisma/client';
import {
  FootballProviderError,
  type ProviderArea,
  type ProviderClub,
  type ProviderClubRef,
  type ProviderCompetition,
  type ProviderMatch,
  type ProviderMatchScore,
  type ProviderSeason,
  type ProviderSeasonClubs,
  type ProviderSeasonStandings,
  type ProviderStandingTable,
} from '../football-provider.port';
import type {
  FdArea,
  FdCompetition,
  FdMatch,
  FdScore,
  FdScoreSide,
  FdSeason,
  FdStanding,
  FdStandingsResponse,
  FdTeam,
  FdTeamRef,
  FdTeamsResponse,
} from './football-data.types';

/**
 * Fd* → Provider* — єдине місце, що знає формат football-data (розділ 6.1, P5-2).
 * Чисті функції: без Nest і БД.
 */

/**
 * Турніри збірних: провайдер ніяк не позначає збірну (F7 — `name === area.name` ламається
 * на «Czechia» / «Bosnia-Herzegovina»), тож рід визначає турнір. Free tier: WC, EC.
 */
const NATIONAL_TEAM_COMPETITION_CODES: ReadonlySet<string> = new Set([
  'WC',
  'EC',
]);

const DEFAULT_STAGE = 'REGULAR_SEASON';

const MATCH_STATUS_BY_FD_STATUS: Readonly<Record<string, MatchStatus>> = {
  SCHEDULED: MatchStatus.SCHEDULED,
  TIMED: MatchStatus.SCHEDULED,
  IN_PLAY: MatchStatus.LIVE,
  EXTRA_TIME: MatchStatus.LIVE,
  PENALTY_SHOOTOUT: MatchStatus.LIVE,
  PAUSED: MatchStatus.PAUSED,
  FINISHED: MatchStatus.FINISHED,
  AWARDED: MatchStatus.AWARDED,
  POSTPONED: MatchStatus.POSTPONED,
  SUSPENDED: MatchStatus.SUSPENDED,
  CANCELLED: MatchStatus.CANCELLED,
};

const WINNER_BY_FD_WINNER: Readonly<Record<string, MatchWinner>> = {
  HOME_TEAM: MatchWinner.HOME,
  AWAY_TEAM: MatchWinner.AWAY,
  DRAW: MatchWinner.DRAW,
};

const STANDING_TYPE_BY_FD_TYPE: Readonly<Record<string, StandingType>> = {
  TOTAL: StandingType.TOTAL,
  HOME: StandingType.HOME,
  AWAY: StandingType.AWAY,
};

function invalidResponse(message: string): FootballProviderError {
  return new FootballProviderError('INVALID_RESPONSE', message);
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/** Невідомий статус → `SCHEDULED` (синк не падає на новому значенні провайдера). */
export function mapFdMatchStatus(fdStatus: string): MatchStatus {
  return MATCH_STATUS_BY_FD_STATUS[fdStatus] ?? MatchStatus.SCHEDULED;
}

/** Стадія як є, у форматі `A-Z0-9_` (D18): нова стадія провайдера не ламає синк. */
export function normalizeFdStage(fdStage: string | null | undefined): string {
  const normalized = (fdStage ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || DEFAULT_STAGE;
}

/** Лише справжні групи (`GROUP_A`, «Group A»); підписи на кшталт «Matchday» → `null` (F3). */
export function normalizeFdGroupName(
  fdGroup: string | null | undefined,
): string | null {
  const normalized = (fdGroup ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  return /^GROUP_[A-Z0-9]{1,3}$/.test(normalized) ? normalized : null;
}

/** `"2026"`, якщо сезон у межах року (WC, EC), інакше `"2025/26"`. */
export function seasonLabelFromDates(
  startDate: string,
  endDate: string,
): string {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  return startYear === endYear ? startYear : `${startYear}/${endYear.slice(2)}`;
}

/** Рік старту сезону — так football-data адресує сезон у `?season=`. */
export function fdSeasonQueryYear(season: ProviderSeason): string {
  return season.startDate.slice(0, 4);
}

export function mapFdArea(
  fdArea: FdArea | null | undefined,
): ProviderArea | null {
  const code = trimmedOrNull(fdArea?.code)?.toUpperCase();
  if (!code) return null;
  return {
    code,
    name: trimmedOrNull(fdArea?.name) ?? code,
    flagUrl: trimmedOrNull(fdArea?.flag),
  };
}

export function mapFdSeason(fdSeason: FdSeason): ProviderSeason {
  const startDate = fdSeason.startDate?.slice(0, 10);
  const endDate = fdSeason.endDate?.slice(0, 10);
  if (!fdSeason.id || !startDate || !endDate) {
    throw invalidResponse(`season without id / dates: ${fdSeason.id}`);
  }
  return {
    externalId: String(fdSeason.id),
    label: seasonLabelFromDates(startDate, endDate),
    startDate,
    endDate,
    currentMatchday: integerOrNull(fdSeason.currentMatchday),
  };
}

export function mapFdCompetition(
  fdCompetition: FdCompetition,
): ProviderCompetition {
  return {
    externalId: String(fdCompetition.id),
    name: fdCompetition.name,
    emblemUrl: trimmedOrNull(fdCompetition.emblem),
    area: mapFdArea(fdCompetition.area),
    participantKind: clubKindForFdCompetition(fdCompetition.code),
    currentSeason: fdCompetition.currentSeason
      ? mapFdSeason(fdCompetition.currentSeason)
      : null,
  };
}

/** `null` — учасник не визначений (`id: null` у плей-оф до жеребкування, F5). */
export function mapFdTeamRef(
  fdTeam: FdTeamRef | null | undefined,
): ProviderClubRef | null {
  if (fdTeam?.id === null || fdTeam?.id === undefined) return null;
  const name =
    trimmedOrNull(fdTeam.name) ??
    trimmedOrNull(fdTeam.shortName) ??
    trimmedOrNull(fdTeam.tla);
  if (!name) return null;
  return {
    externalId: String(fdTeam.id),
    name,
    shortName: trimmedOrNull(fdTeam.shortName),
    tla: trimmedOrNull(fdTeam.tla),
    crestUrl: trimmedOrNull(fdTeam.crest),
  };
}

export function clubKindForFdCompetition(
  competitionCode: string | null | undefined,
): ClubKind {
  const code = competitionCode?.trim().toUpperCase();
  return code && NATIONAL_TEAM_COMPETITION_CODES.has(code)
    ? ClubKind.NATIONAL
    : ClubKind.CLUB;
}

export function mapFdTeam(fdTeam: FdTeam, kind: ClubKind): ProviderClub {
  const clubRef = mapFdTeamRef(fdTeam);
  if (!clubRef) {
    throw invalidResponse(`team without id / name in /teams: ${fdTeam.id}`);
  }
  return {
    ...clubRef,
    kind,
    area: mapFdArea(fdTeam.area),
    founded: integerOrNull(fdTeam.founded),
    venueName: trimmedOrNull(fdTeam.venue),
    websiteUrl: trimmedOrNull(fdTeam.website),
    clubColors: trimmedOrNull(fdTeam.clubColors),
  };
}

export function mapFdTeamsResponse(
  response: FdTeamsResponse,
): ProviderSeasonClubs {
  if (!response.season?.id) {
    throw invalidResponse('/teams without season');
  }
  const kind = clubKindForFdCompetition(response.competition?.code);
  return {
    seasonExternalId: String(response.season.id),
    clubs: (response.teams ?? []).map((fdTeam) => mapFdTeam(fdTeam, kind)),
  };
}

function scoreSideOrNull(
  scoreSide: FdScoreSide | null | undefined,
  side: 'home' | 'away',
): number | null {
  return integerOrNull(scoreSide?.[side]);
}

/**
 * Рахунок без серії пенальті (F2): основний + додатковий час, якщо провайдер їх дав;
 * інакше `fullTime − penalties`.
 */
function goalsWithoutShootout(
  fdScore: FdScore | null | undefined,
  side: 'home' | 'away',
): number | null {
  const regularTimeGoals = scoreSideOrNull(fdScore?.regularTime, side);
  if (regularTimeGoals !== null) {
    return regularTimeGoals + (scoreSideOrNull(fdScore?.extraTime, side) ?? 0);
  }
  const fullTimeGoals = scoreSideOrNull(fdScore?.fullTime, side);
  if (fullTimeGoals === null) return null;
  const shootoutGoals = scoreSideOrNull(fdScore?.penalties, side) ?? 0;
  return Math.max(0, fullTimeGoals - shootoutGoals);
}

export function mapFdScore(
  fdScore: FdScore | null | undefined,
): ProviderMatchScore {
  return {
    home: goalsWithoutShootout(fdScore, 'home'),
    away: goalsWithoutShootout(fdScore, 'away'),
    homeHalfTime: scoreSideOrNull(fdScore?.halfTime, 'home'),
    awayHalfTime: scoreSideOrNull(fdScore?.halfTime, 'away'),
    homePenalties: scoreSideOrNull(fdScore?.penalties, 'home'),
    awayPenalties: scoreSideOrNull(fdScore?.penalties, 'away'),
  };
}

function minuteOrNull(
  fdMinute: number | string | null | undefined,
): number | null {
  const minute =
    typeof fdMinute === 'string' ? Number.parseInt(fdMinute, 10) : fdMinute;
  return typeof minute === 'number' &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 200
    ? minute
    : null;
}

export function mapFdMatch(fdMatch: FdMatch): ProviderMatch {
  const kickoffAt = new Date(fdMatch.utcDate);
  if (Number.isNaN(kickoffAt.getTime())) {
    throw invalidResponse(`match ${fdMatch.id}: bad utcDate`);
  }
  if (!fdMatch.season?.id) {
    throw invalidResponse(`match ${fdMatch.id}: no season`);
  }
  return {
    externalId: String(fdMatch.id),
    seasonExternalId: String(fdMatch.season.id),
    kickoffAt,
    status: mapFdMatchStatus(fdMatch.status),
    minute: minuteOrNull(fdMatch.minute),
    stage: normalizeFdStage(fdMatch.stage),
    groupName: normalizeFdGroupName(fdMatch.group),
    matchday: integerOrNull(fdMatch.matchday),
    homeClub: mapFdTeamRef(fdMatch.homeTeam),
    awayClub: mapFdTeamRef(fdMatch.awayTeam),
    score: mapFdScore(fdMatch.score),
    winner: WINNER_BY_FD_WINNER[fdMatch.score?.winner ?? ''] ?? null,
    venueName: trimmedOrNull(fdMatch.venue),
  };
}

function mapFdStanding(fdStanding: FdStanding): ProviderStandingTable | null {
  const type = STANDING_TYPE_BY_FD_TYPE[fdStanding.type ?? ''];
  if (!type) return null;
  const rows = (fdStanding.table ?? []).flatMap((fdRow) => {
    const club = mapFdTeamRef(fdRow.team);
    if (!club || !Number.isInteger(fdRow.position)) return [];
    return [
      {
        position: fdRow.position,
        club,
        played: integerOrNull(fdRow.playedGames) ?? 0,
        won: integerOrNull(fdRow.won) ?? 0,
        drawn: integerOrNull(fdRow.draw) ?? 0,
        lost: integerOrNull(fdRow.lost) ?? 0,
        points: integerOrNull(fdRow.points) ?? 0,
        goalsFor: integerOrNull(fdRow.goalsFor) ?? 0,
        goalsAgainst: integerOrNull(fdRow.goalsAgainst) ?? 0,
        goalDiff: integerOrNull(fdRow.goalDifference) ?? 0,
        form: trimmedOrNull(fdRow.form),
      },
    ];
  });
  return {
    stage: normalizeFdStage(fdStanding.stage),
    groupName: normalizeFdGroupName(fdStanding.group),
    type,
    rows,
  };
}

export function mapFdStandingsResponse(
  response: FdStandingsResponse,
): ProviderSeasonStandings {
  if (!response.season?.id) {
    throw invalidResponse('/standings without season');
  }
  return {
    seasonExternalId: String(response.season.id),
    tables: (response.standings ?? []).flatMap((fdStanding) => {
      const table = mapFdStanding(fdStanding);
      return table && table.rows.length > 0 ? [table] : [];
    }),
  };
}
