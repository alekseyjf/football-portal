import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  PAGE_NUMBER_MAX,
  POSTS_FILTER_VALUES_MAX,
  POSTS_PAGE_LIMIT_MAX,
  SLUG_PATTERN,
  TAG_SLUG_MAX_LENGTH,
} from '@football-portal/validation';
import {
  IsSlugList,
  type SlugListRule,
} from '../../common/validation/slug-list.decorator';
import { ContentLanguageQueryDto } from '../../languages/dto/content-language-query.dto';

const DEFAULT_PAGE_LIMIT = 10;

/** Slug тегу — як у `GET /tags/{slug}` (D45). */
const TAG_FILTER: SlugListRule = {
  pattern: SLUG_PATTERN,
  maxLength: TAG_SLUG_MAX_LENGTH,
  maxValues: POSTS_FILTER_VALUES_MAX,
};
/** Код турніру (`PL`, `BL1`) — той самий формат, що й `?league=` у `GET /football/matches`. */
const COMPETITION_FILTER: SlugListRule = {
  pattern: /^[A-Za-z0-9-]+$/,
  maxLength: 32,
  maxValues: POSTS_FILTER_VALUES_MAX,
};
/** Slug клубу будує синк з назви без обрізання (P5-5): найдовший на dev-БД — 29 символів, 100 — з запасом. */
const CLUB_FILTER: SlugListRule = {
  pattern: SLUG_PATTERN,
  maxLength: 100,
  maxValues: POSTS_FILTER_VALUES_MAX,
};

/**
 * `GET /posts?page=&limit=&lang=&tags=&competition=&club=` — `abc` / `0` / `1000` / `1e20` → 400 (раніше
 * `NaN` → 500); фільтр не того формату чи з 21 значенням → 400 (Rule 12).
 */
export class ListPostsQueryDto extends ContentLanguageQueryDto {
  // Поле з дефолтом — необов'язкове в запиті, хоч у коді завжди число
  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_NUMBER_MAX)
  page: number = 1;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTS_PAGE_LIMIT_MAX)
  limit: number = DEFAULT_PAGE_LIMIT;

  /** Slug-и тегів через кому (`transfers,injuries`), до 20: новини з будь-яким із них. Разом з іншими фільтрами — «і»; невідомий slug нічого не знаходить */
  @IsOptional()
  @IsSlugList(TAG_FILTER)
  tags?: string;

  /** Slug-и турнірів через кому (`PL,CL`), до 20: новини, прив'язані до будь-якого з них (лише прив'язка самої новини, не клубів турніру) */
  @IsOptional()
  @IsSlugList(COMPETITION_FILTER)
  competition?: string;

  /** Slug-и клубів через кому (`arsenal,chelsea`), до 20: новини, прив'язані до будь-якого з них */
  @IsOptional()
  @IsSlugList(CLUB_FILTER)
  club?: string;
}
