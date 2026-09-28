/**
 * Спільні типи публічного API (web, admin, за потреби — контроль відповідностей на api).
 * Дати з API — ISO string (JSON).
 */

// ─── Users ───

/**
 * Автор поста/коментаря у публічних відповідях. Для видаленого акаунта `name` = 'Deleted user'
 * з БД, але UI показує локалізований підпис за `isDeleted`.
 */
export interface PublicAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  isDeleted: boolean;
}

export type UserRole = 'USER' | 'ADMIN';

/** Поточний користувач: `POST /auth/login`, `GET /auth/me`. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
}

// ─── Posts + i18n ───

/** Мова контенту для query `lang` у GET /posts, /posts/:slug (`Language.code`). */
export type ApiContentLanguage = 'en' | 'ua';

export const DEFAULT_CONTENT_LANG: ApiContentLanguage = 'en';

export type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

/** Тег з назвою запитаною мовою (fallback — default-мова, далі slug). */
export interface PostTag {
  id: string;
  slug: string;
  name: string;
}

/**
 * Пост у стрічці (GET /posts). Переклад уже вибрано API: запитана мова, а якщо перекладу
 * немає — default (en). `resolvedLanguage` ≠ запитаній → показати «переклад недоступний».
 */
export interface Post {
  id: string;
  slug: string;
  publishedAt: string;
  coverImageUrl: string | null;
  resolvedLanguage: string;
  title: string;
  excerpt: string;
  author: PublicAuthor;
  tags: PostTag[];
}

/** Рекурсивне дерево відповідей (як на YouTube). */
export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  pinnedAt?: string | null;
  parentId?: string | null;
  author: PublicAuthor;
  replies?: Comment[];
}

export interface PaginatedPosts {
  data: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** GET /posts/:slug. Коментарі — окремо: GET /comments/post/:postId. */
export interface PostDetail extends Post {
  content: string;
  videoUrl: string | null;
  sourceUrl: string | null;
  /** Мови, якими є переклад (для `hreflang`) */
  availableLanguages: string[];
  competitions: {
    id: string;
    slug: string;
    name: string;
    emblemUrl: string | null;
  }[];
  clubs: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
    crestUrl: string | null;
  }[];
}

// ─── Likes ───

export type LikeTargetType = 'post' | 'comment' | 'match';

/** Публічна статистика (без кількості дизлайків). */
export interface LikeStatsResponse {
  likesCount: number;
  myReaction: 'LIKE' | 'DISLIKE' | null;
}

// ─── Football (GET з нашої БД, season-aware — план 5.1, P5-16 / P5-17) ───

/** `PAUSED` — перерва (HT); `SUSPENDED` — перервано; `AWARDED` — технічний результат. */
export type MatchStatusDto =
  | 'SCHEDULED'
  | 'LIVE'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'AWARDED';

/** Матч іде зараз: «наживо» в UI. */
export const IN_PLAY_MATCH_STATUSES: readonly MatchStatusDto[] = [
  'LIVE',
  'PAUSED',
];

/** Статус остаточний — LIVE-оновлення не потрібні. */
export const TERMINAL_MATCH_STATUSES: readonly MatchStatusDto[] = [
  'FINISHED',
  'CANCELLED',
  'AWARDED',
  'POSTPONED',
];

export type CompetitionType = 'LEAGUE' | 'CUP';

/**
 * Стадії, що йдуть турами (ліга, ліга-фаза, групи): `matchday` — номер туру. У плей-оф
 * `matchday` не тур (WC — `null`, EC — 4–7), підпис — лише стадія. Як `MATCHDAY_STAGES` в API.
 */
export const MATCHDAY_STAGES: readonly string[] = [
  'REGULAR_SEASON',
  'LEAGUE_STAGE',
  'GROUP_STAGE',
];

export type StandingTypeDto = 'TOTAL' | 'HOME' | 'AWAY';

export interface FootballClub {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tla: string | null;
  crestUrl: string | null;
}

export interface FootballArea {
  code: string;
  name: string;
  flagUrl: string | null;
}

/** Сезон турніру. `label` — «2025/26» або «2026»; у URL — `?season=2025-26`. Дати — YYYY-MM-DD. */
export interface FootballSeason {
  label: string;
  isCurrent: boolean;
  currentMatchday: number | null;
  startDate: string;
  endDate: string;
}

/** GET /football/leagues (лише активні, за `sortOrder`), GET /football/leagues/:slug */
export interface FootballLeagueMeta {
  id: string;
  slug: string;
  name: string;
  type: CompetitionType;
  emblemUrl: string | null;
  area: FootballArea | null;
  /** `null` — турнір ще не синкали */
  currentSeason: FootballSeason | null;
}

export interface FootballMatchRow {
  id: string;
  kickoffAt: string;
  status: MatchStatusDto;
  minute: number | null;
  matchday: number | null;
  /** REGULAR_SEASON, LEAGUE_STAGE, GROUP_STAGE, LAST_16, … */
  stage: string;
  /** GROUP_A … або `null` */
  groupName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeClub: FootballClub;
  awayClub: FootballClub;
}

export interface StandingRow {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
  club: FootballClub;
}

/** GET /football/leagues/:slug/standings → `StandingTable[]` */
export interface StandingTable {
  stage: string;
  groupName: string | null;
  type: StandingTypeDto;
  rows: StandingRow[];
}

/**
 * Тур у сайдбарі / `fixtures`: у лізі, ліга-фазі й групах — `(stage, matchday)`; у плей-оф —
 * уся стадія (`matchday: null`, обидва матчі раунду разом). Тури — за часом стадій.
 */
export interface FixturesRound {
  /** REGULAR_SEASON, LEAGUE_STAGE, GROUP_STAGE, LAST_16, FINAL, … */
  stage: string;
  matchday: number | null;
  matches: FootballMatchRow[];
}

export interface LeagueFixturesResponse {
  upcoming: FixturesRound[];
  past: FixturesRound[];
}

/**
 * GET /football/leagues/:slug/dashboard[?season=2025-26]. `standings` — головна таблиця
 * (ліга / ліга-фаза / перша група). `season: null` — турнір ще не синкали.
 */
export interface LeagueDashboardResponse {
  league: FootballLeagueMeta;
  season: FootballSeason | null;
  /**
   * Яка таблиця в `standings` (заголовок: «Таблиця» / «Ліга-фаза» / «Група A»). `null` — таблиці
   * немає: турнір ще не синкали або провайдер її не дає (EC 2024)
   */
  standingsTable: Pick<StandingTable, 'stage' | 'groupName'> | null;
  standings: StandingRow[];
  fixtures: LeagueFixturesResponse;
}

export type MatchWinnerDto = 'HOME' | 'AWAY' | 'DRAW';

/** GET /football/matches/:id. Рахунок — без серії пенальті (вона окремо). */
export interface MatchDetail extends FootballMatchRow {
  homeScoreHalfTime: number | null;
  awayScoreHalfTime: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winner: MatchWinnerDto | null;
  venueName: string | null;
  league: Pick<FootballLeagueMeta, 'id' | 'slug' | 'name' | 'type' | 'emblemUrl'>;
  season: Pick<FootballSeason, 'label' | 'isCurrent'>;
}

// ─── Football: синк (адмінка) ───

export type SyncStatusDto = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

/** `SyncRun.stats` — що зроблено за запуск. */
export interface SyncRunStats {
  apiCalls: number;
  seasonLabel: string | null;
  seasonChanged: boolean;
  clubsCreated: number;
  clubsUpdated: number;
  seasonClubs: number;
  matchesCreated: number;
  matchesUpdated: number;
  matchesSkipped: number;
  matchesUndecided: number;
  matchesUnknown: number;
  matchesFailed: number;
  standingsTables: number;
  standingsRows: number;
  standingsFailed: number;
  standingsUnavailable: boolean;
}

/** GET /football/sync-runs (ADMIN) */
export interface SyncRunRow {
  id: string;
  provider: string;
  scope: 'COMPETITION_FULL' | 'MATCHES_LIVE' | 'STANDINGS';
  /** Slug турніру */
  targetRef: string;
  trigger: 'ADMIN' | 'CRON' | 'LIVE_TOUCH';
  status: SyncStatusDto;
  startedAt: string;
  finishedAt: string | null;
  /** `null` — запуск ще йде або знятий як застарілий (`errorMessage` — `STALE: …`) */
  stats: SyncRunStats | null;
  errorMessage: string | null;
}
