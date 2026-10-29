import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
} from '@football-portal/validation';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';

/**
 * Текст коментаря — один клас для нового й зміненого (D27): межі однакові за побудовою. Декоратори — не обгорткою
 * `applyDecorators`: CLI-плагін Swagger бере `minLength` / `maxLength` лише з них самих.
 */
export class CommentContentDto {
  /** Текст коментаря; пробіли по краях обрізаються */
  // Межі — з `@football-portal/validation` (ті самі, що у формі коментаря на web)
  @TrimString()
  @IsString()
  @MinLength(COMMENT_MIN_LENGTH)
  @MaxLength(COMMENT_MAX_LENGTH)
  content!: string;
}
