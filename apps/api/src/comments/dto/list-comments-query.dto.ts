import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMMENTS_PAGE_LIMIT_MAX } from '@football-portal/validation';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COMMENT_REPLIES_PAGE_LIMIT,
  COMMENT_ROOT_SORTS,
  COMMENT_ROOTS_PAGE_LIMIT,
  type CommentRootSort,
} from '../comment-page';
import { COMMENT_REF_MAX_LENGTH } from './create-comment.dto';

/** Курсор, який видає API, — ~150 символів; більше — сміття, 400 ще до розбору (Rule 12). */
const COMMENT_CURSOR_MAX_LENGTH = 512;

/** Курсор наступної порції (D27): невалідний, з іншого списку чи порядку → 400 `COMMENT_CURSOR_INVALID`. */
class CommentPageQueryDto {
  /** `nextCursor` попередньої порції — як є; без нього — перша порція */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_CURSOR_MAX_LENGTH)
  cursor?: string;
}

/**
 * `GET /comments?postId=|matchId=&sort=newest&cursor=&limit=` — корені новини чи матчу (D27). Рівно одне з
 * `postId` / `matchId` — перевіряє сервіс (`COMMENT_TARGET_INVALID`, як у `POST /comments`).
 */
export class ListCommentsQueryDto extends CommentPageQueryDto {
  /** Новина, чиї коментарі читаємо */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  postId?: string;

  /** Матч, чиї коментарі читаємо */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  matchId?: string;

  /** Порядок коренів: `newest` — нові першими. Обов'язковий: значення за замовчуванням немає, тож новий порядок (M2.14) не змінить відповідь клієнтам, що його не просили */
  @ApiProperty({ enum: COMMENT_ROOT_SORTS, enumName: 'CommentSort' })
  @IsIn(COMMENT_ROOT_SORTS)
  sort!: CommentRootSort;

  // Поле з дефолтом — необов'язкове в запиті, хоч у коді завжди число
  @ApiPropertyOptional({ type: 'integer', default: COMMENT_ROOTS_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMENTS_PAGE_LIMIT_MAX)
  limit: number = COMMENT_ROOTS_PAGE_LIMIT;
}

/** `GET /comments/{id}/replies?cursor=&limit=` — відповіді гілки, від старих до нових (D27). */
export class ListCommentRepliesQueryDto extends CommentPageQueryDto {
  @ApiPropertyOptional({ type: 'integer', default: COMMENT_REPLIES_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMENTS_PAGE_LIMIT_MAX)
  limit: number = COMMENT_REPLIES_PAGE_LIMIT;
}
