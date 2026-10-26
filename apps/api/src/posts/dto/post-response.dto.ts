import { TagDto } from '../../tags/dto/tag-response.dto';
import { PublicAuthorDto } from '../../users/dto/public-author-response.dto';

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
  /** Опис обкладинки для незрячих (`alt`) — мовою `resolvedLanguage`, як і текст */
  coverImageAlt!: string | null;
  /** Мова, якою віддано текст */
  resolvedLanguage!: string;
  title!: string;
  /** Анонс — простий текст, без Markdown */
  excerpt!: string;
  author!: PublicAuthorDto;
  tags!: TagDto[];
  /** Турніри, до яких прив'язана новина, — у порядку редакції */
  competitions!: PostCompetitionDto[];
}

/** Новина з текстом. Коментарі — окремо: `GET /comments/post/{postId}`. */
export class PostDetailDto extends PostSummaryDto {
  /**
   * Текст новини — Markdown (D25), як його зберегла редакція. Рендерить клієнт:
   * сирий HTML ігнорує, зображення — лише https
   */
  content!: string;
  /** Підпис автора фото обкладинки, без «Фото:» — його додає сайт мовою сторінки */
  coverImageCredit!: string | null;
  /** Відео YouTube — завжди канонічне `https://www.youtube.com/watch?v={id}` (D54); `null` — відео немає */
  videoUrl!: string | null;
  /** Посилання на джерело новини (http або https); `null` — джерела немає */
  sourceUrl!: string | null;
  /** Назва джерела («BBC Sport»); `null` — показати домен із `sourceUrl`. Без адреси назви не буває */
  sourceName!: string | null;
  /** Мови, якими є переклад (для `hreflang`) */
  availableLanguages!: string[];
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

/**
 * Новини головної сторінки сайту (D56): головна — закріплена редактором, інакше найсвіжіша; під нею — шість
 * найсвіжіших без неї. Хто й коли закріпив — лише в адмінці.
 */
export class HomePostsDto {
  /** `null` — живих новин немає */
  lead!: PostSummaryDto | null;
  latest!: PostSummaryDto[];
}
