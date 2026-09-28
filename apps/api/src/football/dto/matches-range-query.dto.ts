import { IsOptional, IsString, Matches } from 'class-validator';
import { IsIsoDateTimeWithZone } from '../../common/validation/iso-date-time.decorator';

/** `PL,CL` — до 20 slug-ів турнірів через кому (межі параметрів — 🧭 п. 6 плану). */
const LEAGUE_SLUG_LIST_PATTERN =
  /^[A-Za-z0-9-]{1,32}(,[A-Za-z0-9-]{1,32}){0,19}$/;

/**
 * `GET /football/matches?from=&to=&league=`. Межі — миттєвості з поясом (`Z` / `±hh:mm`): день
 * рахує клієнт у своєму поясі, а не сервер (🧭 п. 3). Інтервал і його довжину перевіряє сервіс.
 */
export class MatchesRangeQueryDto {
  @IsString()
  @IsIsoDateTimeWithZone('from')
  from!: string;

  @IsString()
  @IsIsoDateTimeWithZone('to')
  to!: string;

  @IsOptional()
  @IsString()
  @Matches(LEAGUE_SLUG_LIST_PATTERN, { message: 'LEAGUE_LIST_INVALID' })
  league?: string;
}
