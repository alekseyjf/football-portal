import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import {
  POST_TRANSLATIONS_MAX,
  PostFieldsDto,
  PostTranslationDto,
} from './post-fields.dto';

export { PostTranslationDto } from './post-fields.dto';

/**
 * `POST /posts` (ADMIN). Переклад default-мови обов'язковий (перевіряє сервіс — потрібна БД);
 * без `status` — чернетка.
 */
export class CreatePostDto extends PostFieldsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(POST_TRANSLATIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PostTranslationDto)
  translations: PostTranslationDto[];
}
