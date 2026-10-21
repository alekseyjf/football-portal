import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { TRANSLATIONS_PER_REQUEST_MAX } from '../../languages/dto/translation-fields';
import { PostFieldsDto, PostTranslationDto } from './post-fields.dto';

export { PostTranslationDto } from './post-fields.dto';

/**
 * `POST /posts` (ADMIN). Переклад default-мови обов'язковий (перевіряє сервіс — потрібна БД);
 * без `status` — чернетка.
 */
export class CreatePostDto extends PostFieldsDto {
  /** Переклади, кожна мова — один раз; англійський (default) — обов'язковий */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TRANSLATIONS_PER_REQUEST_MAX)
  @ValidateNested({ each: true })
  @Type(() => PostTranslationDto)
  translations!: PostTranslationDto[];
}
