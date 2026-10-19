import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

/** Тег; назва — запитаною мовою (немає — default-мовою, далі slug). */
export class PostTagDto {
  id!: string;
  slug!: string;
  name!: string;
}

/** Турнір, до якого прив'язана новина. */
export class PostCompetitionDto {
  id!: string;
  slug!: string;
  name!: string;
  emblemUrl!: string | null;
}

/** Клуб, до якого прив'язана новина. */
export class PostClubDto {
  id!: string;
  slug!: string;
  name!: string;
  shortName!: string | null;
  crestUrl!: string | null;
}

/**
 * Новина в стрічці. Переклад уже обрано: запитана мова, а без неї — default (`en`);
 * `resolvedLanguage` ≠ запитаній → клієнт показує «переклад недоступний».
 */
export class PostSummaryDto {
  id!: string;
  /** Номер новини: URL — `/{locale}/news/{slug}-{number}` (D24) */
  number!: number;
  /** Канонічний slug — один на всі мови, з EN-заголовка */
  slug!: string;
  publishedAt!: Date;
  coverImageUrl!: string | null;
  /** Мова, якою віддано текст */
  resolvedLanguage!: string;
  title!: string;
  excerpt!: string;
  author!: PublicAuthorDto;
  tags!: PostTagDto[];
}

/** Новина з текстом. Коментарі — окремо: `GET /comments/post/{postId}`. */
export class PostDetailDto extends PostSummaryDto {
  content!: string;
  videoUrl!: string | null;
  sourceUrl!: string | null;
  /** Мови, якими є переклад (для `hreflang`) */
  availableLanguages!: string[];
  competitions!: PostCompetitionDto[];
  clubs!: PostClubDto[];
}

/** Сторінка стрічки: новіші першими. */
export class PaginatedPostsDto {
  data!: PostSummaryDto[];
  /** Усього живих новин */
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}
