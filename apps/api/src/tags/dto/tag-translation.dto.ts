import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
} from '@football-portal/validation';
import { IsString, Length } from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';
import { IsTranslationLanguageCode } from '../../languages/dto/translation-fields';

/** Назва тегу однією мовою — у тілі `POST` / `PUT /tags`. */
export class TagTranslationDto {
  /** Код мови (`en`, `uk`); мова має бути увімкнена */
  @IsTranslationLanguageCode()
  languageCode!: string;

  /** Назва теми цією мовою — коротко, простим текстом: `Transfers`, `Трансфери` */
  @TrimString()
  @IsString()
  @Length(TAG_NAME_MIN_LENGTH, TAG_NAME_MAX_LENGTH)
  name!: string;
}
