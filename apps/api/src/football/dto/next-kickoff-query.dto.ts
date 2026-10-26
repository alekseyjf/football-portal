import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsIsoDateTimeWithZone } from '../../common/validation/iso-date-time.decorator';

/**
 * `GET /football/matches/next-kickoff?from=` — миттєвість з поясом (`Z` / `±hh:mm`): день, з якого шукати, рахує
 * клієнт у своєму поясі, як і межі `GET /football/matches` (🧭 п. 3).
 */
export class NextKickoffQueryDto {
  /** Від цієї миттєвості (включно) — ISO з поясом: `2026-10-27T00:00:00+02:00` */
  @ApiProperty({ format: 'date-time' })
  @IsString()
  @IsIsoDateTimeWithZone('from')
  from!: string;
}
