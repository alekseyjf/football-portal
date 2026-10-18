import { ApiPropertyOptional } from '@nestjs/swagger';
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
  /** Лише ця стадія: `LEAGUE_STAGE`, `LAST_16`, … (D18) */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]{1,40}$/)
  stage?: string;

  // Поле з дефолтом — необов'язкове в запиті, хоч у коді завжди число
  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;
}
