import type { ApiSchemas } from '../api-schemas';

/** `PAUSED` — перерва (HT); `SUSPENDED` — перервано; `AWARDED` — технічний результат. */
export type MatchStatus = ApiSchemas['MatchStatus'];

/** Матч у списках і турах. Рахунок — без серії пенальті. */
export type MatchRow = ApiSchemas['MatchRowDto'];

/** Турнір матчу (`league` у деталі матчу й у списках за датою). */
export type MatchLeague = ApiSchemas['MatchLeagueDto'];

/** Матч у списку за датою — разом із турніром. */
export type MatchListItem = ApiSchemas['MatchListItemDto'];

/** `GET /football/matches?from=&to=[&league=]` — межі в поясі користувача рахує клієнт. */
export type MatchesInRange = ApiSchemas['MatchesInRangeDto'];

/** `GET /football/matches/next-kickoff?from=` — коли найближчий запланований матч; `null` — попереду нічого. */
export type NextKickoff = ApiSchemas['NextKickoffDto'];

/** `GET /football/matches/{id}`. Серія пенальті — окремо від рахунку. */
export type MatchDetail = ApiSchemas['MatchDetailDto'];

/** Матч іде зараз: «наживо» в UI. */
export const IN_PLAY_MATCH_STATUSES: readonly MatchStatus[] = [
  'LIVE',
  'PAUSED',
];

/** Статус остаточний — LIVE-оновлення не потрібні. */
export const TERMINAL_MATCH_STATUSES: readonly MatchStatus[] = [
  'FINISHED',
  'CANCELLED',
  'AWARDED',
  'POSTPONED',
];
