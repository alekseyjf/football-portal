import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { SITEMAP_MONTH_PATTERN } from '@football-portal/validation';

/** `GET /posts/sitemap/{month}`: `2026-10`; `2026-13`, `26-10` → 400. */
export class SitemapMonthParamDto {
  /** Місяць `publishedAt` в UTC */
  @ApiProperty({ example: '2026-10', pattern: SITEMAP_MONTH_PATTERN.source })
  @Matches(SITEMAP_MONTH_PATTERN)
  month!: string;
}
