import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CommentContentDto } from './comment-content.dto';

/** cuid — 25 символів; межа лише від сміття в запиті, існування перевіряє сервіс. */
export const COMMENT_REF_MAX_LENGTH = 64;

export class CreateCommentDto extends CommentContentDto {
  /** Новина, яку коментують; рівно одне з `postId` / `matchId` */
  // Рівно одне — перевіряє сервіс (P4-1, `COMMENT_TARGET_INVALID`).
  // `null` = не передано: `@IsOptional` пропускає null без решти валідаторів
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  postId?: string | null;

  /** Матч, який коментують */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  matchId?: string | null;

  /** Коментар, на який це відповідь (з того самого треду). Відповідь на відповідь API пише в корінь її гілки й запам'ятовує, кому відповіли (`replyTo`) */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  parentId?: string | null;
}
