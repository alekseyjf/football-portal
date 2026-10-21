import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_POSTS_PAGE_LIMIT_DEFAULT,
  ADMIN_POSTS_PAGE_LIMIT_MAX,
  ADMIN_POSTS_SEARCH_MAX_LENGTH,
  PAGE_NUMBER_MAX,
} from '@football-portal/validation';
import { TrimString } from '../../common/validation/trim-string.transform';

/**
 * `GET /posts/admin/all?page=&limit=&status=&search=` — межі кожного параметра (Rule 12): не той формат,
 * порожній пошук чи повтор параметра → 400.
 */
export class ListAdminPostsQueryDto {
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
  @Max(ADMIN_POSTS_PAGE_LIMIT_MAX)
  limit: number = ADMIN_POSTS_PAGE_LIMIT_DEFAULT;

  /**
   * Статус, як його показує адмінка: PUBLISHED — новини на сайті, і запланована, чия дата настала;
   * SCHEDULED — лише ті, що ще чекають своєї дати
   */
  @ApiPropertyOptional({ enum: PostStatus, enumName: 'PostStatus' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  /** Частина заголовка будь-якою мовою, без урахування регістру: `динамо` знайде «Динамо Київ» */
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_POSTS_SEARCH_MAX_LENGTH)
  search?: string;
}
