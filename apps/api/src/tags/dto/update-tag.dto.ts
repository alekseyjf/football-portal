import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { TRANSLATIONS_PER_REQUEST_MAX } from '../../languages/dto/translation-fields';
import { TagTranslationDto } from './tag-translation.dto';

/**
 * `PUT /tags/:id` (ADMIN): назви — upsert за мовою, решта лишається. Slug не змінюється — він уже
 * в адресах сторінки тегу (D45). Видалити назву не можна, як і переклад новини (P3-5): тег лишається з назвою
 * кожною мовою (D51).
 */
export class UpdateTagDto {
  /** Upsert за мовою; мов, яких немає в масиві, зміна не торкається. Порожня назва — 400: прибрати назву не можна */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TRANSLATIONS_PER_REQUEST_MAX)
  @ValidateNested({ each: true })
  @Type(() => TagTranslationDto)
  translations!: TagTranslationDto[];
}
