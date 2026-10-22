import { ApiPropertyOptional } from '@nestjs/swagger';
import { SLUG_PATTERN, TAG_SLUG_MAX_LENGTH } from '@football-portal/validation';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TRANSLATIONS_PER_REQUEST_MAX } from '../../languages/dto/translation-fields';
import { TagTranslationDto } from './tag-translation.dto';

/**
 * `POST /tags` (ADMIN). Назва default-мови обов'язкова (перевіряє сервіс — потрібна БД); з неї —
 * slug, якщо його не задано.
 */
export class CreateTagDto {
  /** Назви, кожна мова — один раз; англійська (default) — обов'язкова */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TRANSLATIONS_PER_REQUEST_MAX)
  @ValidateNested({ each: true })
  @Type(() => TagTranslationDto)
  translations!: TagTranslationDto[];

  /**
   * Адреса сторінки тегу `/{locale}/news/tag/{slug}`: латиниця в нижньому регістрі, цифри, дефіси.
   * Без неї — з англійської назви (обов'язково, якщо в назві немає латиниці). Після створення не змінюється
   */
  @ApiPropertyOptional({ pattern: SLUG_PATTERN.source })
  @IsOptional()
  @IsString()
  @MaxLength(TAG_SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase latin letters and digits joined by single hyphens',
  })
  slug?: string;
}
