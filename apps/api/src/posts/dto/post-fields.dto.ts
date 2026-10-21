import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  POST_CONTENT_MAX_LENGTH,
  POST_CONTENT_MIN_LENGTH,
  POST_COVER_IMAGE_ALT_MAX_LENGTH,
  POST_COVER_IMAGE_CREDIT_MAX_LENGTH,
  POST_EXCERPT_MAX_LENGTH,
  POST_EXCERPT_MIN_LENGTH,
  POST_RELATION_IDS_MAX,
  POST_SLUG_MAX_LENGTH,
  POST_SOURCE_NAME_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  POST_TITLE_MIN_LENGTH,
} from '@football-portal/validation';
import { SLUG_PATTERN } from '../../common/slug';
import { IsIsoDateTimeWithZone } from '../../common/validation/iso-date-time.decorator';
import { TrimString } from '../../common/validation/trim-string.transform';
import {
  IsMediaUrl,
  IsSourceUrl,
} from '../../common/validation/url-field.decorators';
import { IsTranslationLanguageCode } from '../../languages/dto/translation-fields';

/** Максимальна довжина id (cuid) у масивах зв'язків. */
const RELATION_ID_MAX_LENGTH = 64;

export class PostTranslationDto {
  /** Код мови (`en`, `uk`); мова має бути увімкнена */
  @IsTranslationLanguageCode()
  languageCode!: string;

  @TrimString()
  @IsString()
  @Length(POST_TITLE_MIN_LENGTH, POST_TITLE_MAX_LENGTH)
  title!: string;

  /** Анонс — простий текст, без Markdown: іде в стрічку й у `meta description` */
  @TrimString()
  @IsString()
  @Length(POST_EXCERPT_MIN_LENGTH, POST_EXCERPT_MAX_LENGTH)
  excerpt!: string;

  /**
   * Текст новини — Markdown (D25): заголовки h2–h4, списки, цитати, посилання, жирний і курсив,
   * зображення (https), таблиці. API зберігає текст як є й перевіряє лише довжину; решту правил
   * (сирий HTML не показується, зображення лише https) застосовує рендерер сайту
   */
  // Markdown не парсимо (D25): правила безпеки — в одному місці, рендерері, а не у двох копіях, що розійдуться
  @TrimString()
  @IsString()
  @Length(POST_CONTENT_MIN_LENGTH, POST_CONTENT_MAX_LENGTH)
  content!: string;

  /**
   * Опис обкладинки для незрячих цією мовою (`alt`): що на фото, без «Фото…» на початку. Обов'язковий
   * у кожному перекладі, коли опублікована чи запланована новина має обкладинку. Не передано —
   * лишається, поки адреса фото та сама; нове фото чи прибрана обкладинка старого опису не лишають.
   * `null` — прибрати
   */
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_COVER_IMAGE_ALT_MAX_LENGTH)
  coverImageAlt?: string | null;
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

  /**
   * Slug для URL `{slug}-{number}`: латиниця в нижньому регістрі, цифри, дефіси. Без нього — з EN-заголовка,
   * і поки в новини немає дати публікації, slug іде за заголовком; далі змінюється лише так, явно
   */
  // `null` → 400 (а не «не передано»): slug у новини є завжди, прибрати його не можна
  @ApiPropertyOptional({ pattern: SLUG_PATTERN.source })
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @MaxLength(POST_SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase latin letters and digits joined by single hyphens',
  })
  slug?: string;

  /**
   * Обкладинка — лише https; `null` — прибрати разом з описом і підписом. Інша адреса — інше фото:
   * опис і підпис передати знову, старі не переносяться
   */
  @IsOptional()
  @IsMediaUrl()
  coverImageUrl?: string | null;

  /**
   * Підпис автора фото обкладинки — фотограф і звідки фото: `Ім'я автора / Unsplash`,
   * `Stuart MacFarlane / Getty Images` (слово «Фото:» додає сайт). Обов'язковий, коли опублікована
   * чи запланована новина має обкладинку; не передано — лишається, поки адреса фото та сама. `null` — прибрати
   */
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_COVER_IMAGE_CREDIT_MAX_LENGTH)
  coverImageCredit?: string | null;

  /** Лише https; `null` — прибрати */
  @IsOptional()
  @IsMediaUrl()
  videoUrl?: string | null;

  /**
   * Посилання на джерело новини — http(s), одне на новину; `null` — прибрати джерело разом з назвою.
   * Інша адреса — інше джерело: стара назва не переноситься, назву передати знову
   */
  @IsOptional()
  @IsSourceUrl()
  sourceUrl?: string | null;

  /**
   * Назва джерела для читачів: `BBC Sport`, `The Athletic`; без неї сайт покаже домен адреси. Лише разом
   * з адресою: назва без `sourceUrl` → 400 SOURCE_URL_REQUIRED. Не передано — лишається, поки адреса
   * та сама; `null` — прибрати
   */
  @IsOptional()
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_SOURCE_NAME_MAX_LENGTH)
  sourceName?: string | null;

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
