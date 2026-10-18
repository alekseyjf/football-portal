import { ApiProperty } from '@nestjs/swagger';
import { CompetitionType, MatchStatus, MatchWinner } from '@prisma/client';
import { ClubDto } from './club-response.dto';

/** Турнір матчу. */
export class MatchLeagueDto {
  id!: string;
  slug!: string;
  name!: string;

  @ApiProperty({ enum: CompetitionType, enumName: 'CompetitionType' })
  type!: CompetitionType;

  emblemUrl!: string | null;
}

/** Матч у списках і турах. Рахунок — без серії пенальті. */
export class MatchRowDto {
  id!: string;
  kickoffAt!: Date;

  /** `LIVE` / `PAUSED` (перерва) — гра йде */
  @ApiProperty({ enum: MatchStatus, enumName: 'MatchStatus' })
  status!: MatchStatus;

  /** Хвилина гри; `null` — немає даних */
  minute!: number | null;
  /** Тур; у плей-оф це не тур (WC — `null`, EC — 4–7) */
  matchday!: number | null;
  /** `REGULAR_SEASON`, `LEAGUE_STAGE`, `GROUP_STAGE`, `LAST_16`, … — може прийти й нова стадія провайдера */
  stage!: string;
  /** `GROUP_A` … або `null` */
  groupName!: string | null;
  homeScore!: number | null;
  awayScore!: number | null;
  homeClub!: ClubDto;
  awayClub!: ClubDto;
}

/** Матч у списку за датою — разом із турніром. */
export class MatchListItemDto extends MatchRowDto {
  league!: MatchLeagueDto;
}

/** Сезон матчу. */
export class MatchSeasonDto {
  label!: string;
  isCurrent!: boolean;
}

/** Матч повністю. Рахунок — без серії пенальті: вона окремо. */
export class MatchDetailDto extends MatchRowDto {
  homeScoreHalfTime!: number | null;
  awayScoreHalfTime!: number | null;
  /** Серія пенальті; `null` — її не було */
  homePenalties!: number | null;
  awayPenalties!: number | null;

  /** `null` — матч не завершено */
  @ApiProperty({ enum: MatchWinner, enumName: 'MatchWinner', nullable: true })
  winner!: MatchWinner | null;

  venueName!: string | null;
  league!: MatchLeagueDto;
  season!: MatchSeasonDto;
}

/** Матчі за інтервалом — за часом початку. */
export class MatchesInRangeDto {
  matches!: MatchListItemDto[];
}

/** Сторінка матчів сезону, новіші першими. */
export class LeagueMatchesPageDto {
  matches!: MatchRowDto[];
  total!: number;
}
