import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SeasonQueryDto } from './season-query.dto';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
/** `skip` у межах int64 (як у `ListPostsQueryDto`) */
const MAX_PAGE = 100_000;

/** `GET /football/leagues/:slug/matches?season=&stage=&page=&limit=` */
export class LeagueMatchesQueryDto extends SeasonQueryDto {
  /** Нормалізована стадія (D18): `LEAGUE_STAGE`, `LAST_16`, … */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]{1,40}$/)
  stage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;
}
