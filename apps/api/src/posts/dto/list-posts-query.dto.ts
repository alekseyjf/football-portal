import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { POSTS_PAGE_LIMIT_MAX } from '@football-portal/validation';
import { ContentLanguageQueryDto } from '../../languages/dto/content-language-query.dto';

const DEFAULT_PAGE_LIMIT = 10;
/** `?page=1e20` → `skip` не влазить в int64 → 500 у Prisma; 100 000 сторінок — з запасом. */
const MAX_PAGE = 100_000;

/** `GET /posts?page=&limit=&lang=` — `abc` / `0` / `1000` / `1e20` → 400 (раніше `NaN` → 500). */
export class ListPostsQueryDto extends ContentLanguageQueryDto {
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
  @Max(POSTS_PAGE_LIMIT_MAX)
  limit: number = DEFAULT_PAGE_LIMIT;
}
