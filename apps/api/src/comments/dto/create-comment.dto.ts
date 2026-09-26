import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
} from '@football-portal/validation';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';

export class CreateCommentDto {
  /** Межі — з `@football-portal/validation` (ті самі, що у формі коментаря на web) */
  @TrimString()
  @IsString()
  @MinLength(COMMENT_MIN_LENGTH)
  @MaxLength(COMMENT_MAX_LENGTH)
  content: string;

  // Або postId або matchId — валідація в сервісі
  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  matchId?: string;

  // Якщо є parentId — це відповідь на коментар
  @IsString()
  @IsOptional()
  parentId?: string;
}
