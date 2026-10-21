import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import { ClubRefDto } from '../../football/dto/club-response.dto';
import { CompetitionRefDto } from '../../football/dto/league-response.dto';
import { AdminTagRefDto } from '../../tags/dto/tag-response.dto';
import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

/** Переклад у списку адмінки: мова й заголовок. */
export class AdminPostTranslationDto {
  languageCode!: string;
  title!: string;
}

/** Переклад у формі редагування: усі поля. */
export class AdminPostDetailTranslationDto extends AdminPostTranslationDto {
  /** Анонс — простий текст */
  excerpt!: string;
  /** Текст новини — Markdown (D25), як його зберегла редакція */
  content!: string;
  /** Опис обкладинки для незрячих цією мовою; `null` — немає */
  coverImageAlt!: string | null;
}

/** Новина в адмінці: будь-який статус, крім видалених. */
export class AdminPostDto {
  id!: string;
  /** Номер новини: URL на сайті — `/{locale}/news/{slug}-{number}` (D24) */
  number!: number;
  slug!: string;

  @ApiProperty({ enum: PostStatus, enumName: 'PostStatus' })
  status!: PostStatus;

  /** `null` — чернетка без дати */
  publishedAt!: Date | null;
  /** Видно на сайті зараз: запланована, чия дата настала, — теж */
  isLive!: boolean;
  coverImageUrl!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  author!: PublicAuthorDto;
  /** Усі переклади (порядок мов — як на сайті): видно, яких бракує */
  translations!: AdminPostTranslationDto[];
}

// Не `extends AdminPostDto`: поля бази й перевизначені в підкласі `translations` Swagger-плагін бере
// залежно від того, чию схему розібрав першим, — порядок полів у Swagger UI плутався б
/** Новина для форми редагування: усі поля, переклади з текстом, теги, турніри й клуби — у форматі чипів. */
export class AdminPostDetailDto {
  id!: string;
  /** Номер новини: URL на сайті — `/{locale}/news/{slug}-{number}` (D24) */
  number!: number;
  slug!: string;

  @ApiProperty({ enum: PostStatus, enumName: 'PostStatus' })
  status!: PostStatus;

  /** `null` — чернетка без дати */
  publishedAt!: Date | null;
  /** Видно на сайті зараз: запланована, чия дата настала, — теж */
  isLive!: boolean;
  coverImageUrl!: string | null;
  /** Підпис автора фото обкладинки, без «Фото:»; `null` — немає */
  coverImageCredit!: string | null;
  /** `null` — немає */
  videoUrl!: string | null;
  /** Посилання на джерело (http або https); `null` — своя новина */
  sourceUrl!: string | null;
  /** Назва джерела («BBC Sport»); `null` — сайт покаже домен адреси */
  sourceName!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  author!: PublicAuthorDto;
  /** Усі переклади з текстом (порядок мов — як на сайті) */
  translations!: AdminPostDetailTranslationDto[];
  /** Теги — за адресою (slug) */
  tags!: AdminTagRefDto[];
  /** Турніри — у порядку, як на сайті */
  competitions!: CompetitionRefDto[];
  /** Клуби — за абеткою назви */
  clubs!: ClubRefDto[];
}

/** Сторінка списку новин адмінки: нові першими (за датою створення). */
export class PaginatedAdminPostsDto {
  data!: AdminPostDto[];
  /** Усього новин за фільтрами (без видалених) */
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

/** `DELETE /posts/{id}`: новину приховано (soft delete). */
export class DeletedPostDto {
  id!: string;
}
