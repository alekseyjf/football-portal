import { ApiProperty } from '@nestjs/swagger';

/*
 * Відповіді для sitemap сайту (D57): лише живі новини з перекладом default-мови, як у стрічці. Адреса новини —
 * `/{locale}/news/{slug}-{number}`: slug один на всі мови (D24), мови — переклади увімкненими мовами.
 */

/** Місяць sitemap — `publishedAt` в UTC. */
export class PostSitemapMonthDto {
  /** Місяць `YYYY-MM` — ідентифікатор файла: `GET /posts/sitemap/{month}` */
  @ApiProperty({ example: '2026-10' })
  month!: string;
  postCount!: number;
  /** Найсвіжіша зміна адреси місяця: пізніша з дати публікації й правки перекладу — `lastmod` у sitemap index */
  lastModifiedAt!: Date;
}

/** Місяці з новинами, новіші першими. */
export class PostSitemapIndexDto {
  months!: PostSitemapMonthDto[];
}

/** Переклад — адреса новини цією мовою. */
export class PostSitemapTranslationDto {
  languageCode!: string;
  /** Пізніша з дати публікації й правки перекладу — `lastmod` адреси */
  lastModifiedAt!: Date;
}

export class PostSitemapEntryDto {
  number!: number;
  slug!: string;
  /** Мови перекладів у порядку мов сайту: адреса кожною й `hreflang` між ними */
  translations!: PostSitemapTranslationDto[];
}

/** Новини місяця, новіші першими. */
export class PostSitemapDto {
  posts!: PostSitemapEntryDto[];
}

/** Переклад для Google News: адреса цією мовою з її заголовком. */
export class NewsSitemapTranslationDto {
  languageCode!: string;
  title!: string;
}

export class NewsSitemapEntryDto {
  number!: number;
  slug!: string;
  publishedAt!: Date;
  translations!: NewsSitemapTranslationDto[];
}

/** Новини за останні 48 год, новіші першими (Google News sitemap). */
export class NewsSitemapDto {
  posts!: NewsSitemapEntryDto[];
}
