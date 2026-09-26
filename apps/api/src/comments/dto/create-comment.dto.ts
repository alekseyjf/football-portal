import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
} from '@football-portal/validation';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';

/** cuid — 25 символів; межа лише від сміття в запиті, існування перевіряє сервіс. */
const COMMENT_REF_MAX_LENGTH = 64;

export class CreateCommentDto {
  /** Межі — з `@football-portal/validation` (ті самі, що у формі коментаря на web) */
  @TrimString()
  @IsString()
  @MinLength(COMMENT_MIN_LENGTH)
  @MaxLength(COMMENT_MAX_LENGTH)
  content: string;

  // Рівно одне з postId / matchId — перевіряє сервіс (P4-1, `COMMENT_TARGET_INVALID`).
  // `null` = не передано: `@IsOptional` пропускає null без решти валідаторів
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  postId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  matchId?: string | null;

  // Якщо є parentId — це відповідь на коментар того ж треду
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_REF_MAX_LENGTH)
  parentId?: string | null;
}
