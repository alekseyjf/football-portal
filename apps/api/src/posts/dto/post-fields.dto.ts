import { applyDecorators } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
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
import { TrimString } from '../../common/validation/trim-string.transform';
import {
  IsMediaUrl,
  IsSourceUrl,
} from '../../common/validation/url-field.decorators';

/** Максимум перекладів в одному запиті — захист від величезних тіл, не бізнес-правило. */
export const POST_TRANSLATIONS_MAX = 10;

/** Формат `Language.code` (`en`, `ua`); чи мова активна — перевіряє сервіс (P3-3). */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,8}$/;

/**
 * Дата з явною часовою зоною (`Z` або `±hh:mm`): `2026-10-01T10:00` без зони сервер
 * прочитав би у своїй зоні — запланований пост вийшов би не тоді.
 */
const ISO_DATE_WITH_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

/** Максимальна довжина id (cuid) у масивах зв'язків. */
const RELATION_ID_MAX_LENGTH = 64;

export class PostTranslationDto {
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN, { message: 'languageCode must be like "en"' })
  languageCode: string;

  @TrimString()
  @IsString()
  @Length(POST_TITLE_MIN_LENGTH, POST_TITLE_MAX_LENGTH)
  title: string;

  @TrimString()
  @IsString()
  @Length(POST_EXCERPT_MIN_LENGTH, POST_EXCERPT_MAX_LENGTH)
  excerpt: string;

  @TrimString()
  @IsString()
  @Length(POST_CONTENT_MIN_LENGTH, POST_CONTENT_MAX_LENGTH)
  content: string;
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
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  /** `null` — те саме, що не передано (сервіс не перетворює його на `new Date(null)` = 1970) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_DATE_WITH_ZONE_PATTERN, {
    message: 'publishedAt must include a time zone (Z or ±hh:mm)',
  })
  publishedAt?: string | null;

  @IsOptional()
  @IsMediaUrl()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsMediaUrl()
  videoUrl?: string | null;

  @IsOptional()
  @IsSourceUrl()
  sourceUrl?: string | null;

  @RelationIds()
  tagIds?: string[];

  @RelationIds()
  clubIds?: string[];

  @RelationIds()
  competitionIds?: string[];
}
