import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  POST_CONTENT_MAX_LENGTH,
  POST_CONTENT_MIN_LENGTH,
  POST_EXCERPT_MAX_LENGTH,
  POST_EXCERPT_MIN_LENGTH,
  POST_RELATION_IDS_MAX,
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
} from '@football-portal/validation';
import { IsIsoDateTimeWithZone } from '../../common/validation/iso-date-time.decorator';
import { TrimString } from '../../common/validation/trim-string.transform';
import {
  IsMediaUrl,
  IsSourceUrl,
} from '../../common/validation/url-field.decorators';

/** Максимум перекладів в одному запиті — захист від величезних тіл, не бізнес-правило. */
export const POST_TRANSLATIONS_MAX = 10;

/** Формат `Language.code` (`en`, `uk`); чи мова активна — перевіряє сервіс (P3-3). */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,8}$/;

/** Максимальна довжина id (cuid) у масивах зв'язків. */
const RELATION_ID_MAX_LENGTH = 64;

export class PostTranslationDto {
  /** Код мови (`en`, `uk`); мова має бути увімкнена */
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN, { message: 'languageCode must be like "en"' })
  languageCode!: string;

  @TrimString()
  @IsString()
  @Length(POST_TITLE_MIN_LENGTH, POST_TITLE_MAX_LENGTH)
  title!: string;

  @TrimString()
  @IsString()
  @Length(POST_EXCERPT_MIN_LENGTH, POST_EXCERPT_MAX_LENGTH)
  excerpt!: string;

  @TrimString()
  @IsString()
  @Length(POST_CONTENT_MIN_LENGTH, POST_CONTENT_MAX_LENGTH)
  content!: string;
}

/** `tagIds` / `clubIds` / `competitionIds`: чи існують — перевіряє сервіс (P3-8). */
const RelationIds = () =>
  applyDecorators(
    IsOptional(),
    IsArray(),
    ArrayMaxSize(POST_RELATION_IDS_MAX),
    ArrayUnique(),
    IsString({ each: true }),
    MaxLength(RELATION_ID_MAX_LENGTH, { each: true }),
  );

/**
 * Поля, спільні для створення й оновлення. Усі опційні: `undefined` — не змінювати;
 * для URL `null` — очистити. Переходи статусу / дати — `resolvePostPublication` (P3-2).
 */
export class PostFieldsDto {
  /** ARCHIVED — лише для наявної новини */
  @ApiPropertyOptional({ enum: PostStatus, enumName: 'PostStatus' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  /**
   * ISO з поясом (`2026-10-18T09:00:00Z`): SCHEDULED — коли вийде (у майбутньому), PUBLISHED —
   * дата в минулому (без неї — зараз), DRAFT — без дати; `null` — те саме, що не передано
   */
  // `null` сервіс не перетворює на `new Date(null)` = 1970 (backdating)
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsIsoDateTimeWithZone('publishedAt')
  publishedAt?: string | null;

  /** Обкладинка — лише https; `null` — прибрати */
  @IsOptional()
  @IsMediaUrl()
  coverImageUrl?: string | null;

  /** Лише https; `null` — прибрати */
  @IsOptional()
  @IsMediaUrl()
  videoUrl?: string | null;

  /** Посилання на джерело — http(s); `null` — прибрати */
  @IsOptional()
  @IsSourceUrl()
  sourceUrl?: string | null;

  /** Переданий масив замінює наявні зв'язки, відсутній — не змінює */
  @RelationIds()
  tagIds?: string[];

  /** Як `tagIds` */
  @RelationIds()
  clubIds?: string[];

  /** Як `tagIds` */
  @RelationIds()
  competitionIds?: string[];
}
