import { ApiProperty } from '@nestjs/swagger';
import {
  CLUB_SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from '@football-portal/validation';
import { IsString, Matches, MaxLength } from 'class-validator';

/** `GET /football/clubs/{slug}`: slug не того формату чи задовгий → 400 (Rule 12), до запиту в БД. */
export class ClubSlugParamDto {
  /** Slug клубу — той самий, що у фільтрі стрічки `GET /posts?club=` */
  @ApiProperty({
    pattern: SLUG_PATTERN.source,
    maxLength: CLUB_SLUG_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(CLUB_SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN)
  slug!: string;
}
