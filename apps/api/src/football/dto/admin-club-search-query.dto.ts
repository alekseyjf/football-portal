import {
  ADMIN_CLUBS_SEARCH_MAX_LENGTH,
  ADMIN_CLUBS_SEARCH_MIN_LENGTH,
} from '@football-portal/validation';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';

/**
 * `GET /football/clubs/admin/search?search=` — межі параметра (Rule 12): немає, коротший за 2 символи після trim,
 * задовгий чи повтор параметра → 400.
 */
export class AdminClubSearchQueryDto {
  /** Частина назви, короткої назви, коду (`ARS`) чи адреси клубу — латиницею, регістр не важливий: `atletico` знайде «Club Atlético de Madrid» */
  @TrimString()
  @IsString()
  @MinLength(ADMIN_CLUBS_SEARCH_MIN_LENGTH)
  @MaxLength(ADMIN_CLUBS_SEARCH_MAX_LENGTH)
  search!: string;
}
