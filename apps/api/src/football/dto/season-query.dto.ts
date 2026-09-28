import { IsOptional, IsString, Matches } from 'class-validator';
import { SEASON_PARAM_PATTERN } from '../query/football-season-param';

/** `?season=2025-26` / `2026`; без нього — поточний сезон (P5-16). */
export class SeasonQueryDto {
  @IsOptional()
  @IsString()
  @Matches(SEASON_PARAM_PATTERN, { message: 'SEASON_PARAM_INVALID' })
  season?: string;
}
