import type {
  ClubKind,
  DataProvider,
  MatchStatus,
  MatchWinner,
  StandingType,
} from '@prisma/client';

/**
 * Порт зовнішнього постачальника футбольних даних (розділ 6.1, P5-1).
 * Синк працює лише з цими нейтральними типами: формат конкретного API знає тільки його адаптер.
 * Новий провайдер = новий адаптер + значення в `DataProvider`.
 */
export const FOOTBALL_PROVIDER = Symbol('FOOTBALL_PROVIDER');

export interface ProviderArea {
  /** Стабільний код країни / регіону (ENG, EUR, INT) — ключ `Area.code` */
  code: string;
  name: string;
  flagUrl: string | null;
}

export interface ProviderSeason {
  externalId: string;
  /** "2025/26" або "2026" для турніру в межах року */
  label: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  currentMatchday: number | null;
}

export interface ProviderCompetition {
  externalId: string;
  name: string;
  emblemUrl: string | null;
  area: ProviderArea | null;
  /** Рід учасників: збірні чи клуби — і для клубів, відомих лише з матчу / таблиці */
  participantKind: ClubKind;
  /** `null` — провайдер не знає поточного сезону (синкати нічого) */
  currentSeason: ProviderSeason | null;
}

/** Клуб так, як його видно в матчі / рядку таблиці: неповні дані. */
export interface ProviderClubRef {
  externalId: string;
  name: string;
  shortName: string | null;
  tla: string | null;
  crestUrl: string | null;
}

/** Повні дані клубу (склад турніру). Лише з них синк оновлює поля `Club` (P5-4). */
export interface ProviderClub extends ProviderClubRef {
  kind: ClubKind;
  area: ProviderArea | null;
  founded: number | null;
  venueName: string | null;
  websiteUrl: string | null;
  clubColors: string | null;
}

export interface ProviderSeasonClubs {
  seasonExternalId: string;
  clubs: ProviderClub[];
}

export interface ProviderMatchScore {
  /** Рахунок матчу (основний + додатковий час) — без серії пенальті */
  home: number | null;
  away: number | null;
  homeHalfTime: number | null;
  awayHalfTime: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
}

export interface ProviderMatch {
  externalId: string;
  seasonExternalId: string;
  kickoffAt: Date;
  status: MatchStatus;
  minute: number | null;
  /** Нормалізована стадія (D18): REGULAR_SEASON, LEAGUE_STAGE, GROUP_STAGE, LAST_16, … */
  stage: string;
  /** GROUP_A … або `null` поза груповим етапом */
  groupName: string | null;
  matchday: number | null;
  /** `null` — учасник ще не визначений (плей-оф до жеребкування) */
  homeClub: ProviderClubRef | null;
  awayClub: ProviderClubRef | null;
  score: ProviderMatchScore;
  winner: MatchWinner | null;
  venueName: string | null;
}

export interface ProviderStandingRow {
  position: number;
  club: ProviderClubRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
}

/** Одна таблиця: `(stage, groupName, type)` замінюється атомарно (6.2 п. 6). */
export interface ProviderStandingTable {
  stage: string;
  groupName: string | null;
  type: StandingType;
  rows: ProviderStandingRow[];
}

export interface ProviderSeasonStandings {
  seasonExternalId: string;
  tables: ProviderStandingTable[];
}

export type FootballProviderErrorKind =
  /** Ключ не задано або провайдер його відхилив */
  | 'AUTH'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  /** Відповідь не того формату, що очікували */
  | 'INVALID_RESPONSE';

/** Помилка провайдера — без HTTP-семантики Nest: синк записує її в `SyncRun.errorMessage`. */
export class FootballProviderError extends Error {
  constructor(
    readonly kind: FootballProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'FootballProviderError';
  }
}

export interface FootballProvider {
  readonly provider: DataProvider;

  /** Чи є з чим ходити до провайдера (ключ API). Без нього синк не стартує. */
  isConfigured(): boolean;

  fetchCompetition(competitionExternalId: string): Promise<ProviderCompetition>;

  fetchSeasonClubs(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderSeasonClubs>;

  /** Усі матчі сезону (без пагінації на боці провайдера — F1). */
  fetchSeasonMatches(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderMatch[]>;

  /** Матчі турніру з датою початку в `[dateFrom, dateTo]` (UTC-дні) — для LIVE-синку. */
  fetchMatchesBetween(
    competitionExternalId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<ProviderMatch[]>;

  /** `null` — таблиць у провайдера для сезону немає (F4). */
  fetchSeasonStandings(
    competitionExternalId: string,
    season: ProviderSeason,
  ): Promise<ProviderSeasonStandings | null>;
}
