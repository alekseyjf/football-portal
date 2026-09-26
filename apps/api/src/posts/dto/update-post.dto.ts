import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  POST_TRANSLATIONS_MAX,
  PostFieldsDto,
  PostTranslationDto,
} from './post-fields.dto';

/**
 * `PUT /posts/:id` (ADMIN). Переклади — upsert за мовою (кожен повністю: title, excerpt,
 * content); переклади, яких немає в масиві, лишаються. Видалити переклад не можна (P3-5).
 */
export class UpdatePostDto extends PostFieldsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(POST_TRANSLATIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PostTranslationDto)
  translations?: PostTranslationDto[];
}
