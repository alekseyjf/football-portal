import { ApiProperty } from '@nestjs/swagger';
import { SLUG_PATTERN, TAG_SLUG_MAX_LENGTH } from '@football-portal/validation';
import { IsString, Matches, MaxLength } from 'class-validator';

/** `GET /tags/{slug}`: slug не того формату чи задовгий → 400 (Rule 12), до запиту в БД. */
export class TagSlugParamDto {
  /** Slug тегу з адреси сторінки `/{locale}/news/tag/{slug}` */
  @ApiProperty({ pattern: SLUG_PATTERN.source, maxLength: TAG_SLUG_MAX_LENGTH })
  @IsString()
  @MaxLength(TAG_SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN)
  slug!: string;
}
