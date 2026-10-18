import { ApiProperty } from '@nestjs/swagger';
import { StandingType } from '@prisma/client';
import { ClubDto } from './club-response.dto';

/** Рядок турнірної таблиці. */
export class StandingRowDto {
  position!: number;
  played!: number;
  won!: number;
  drawn!: number;
  lost!: number;
  points!: number;
  goalsFor!: number;
  goalsAgainst!: number;
  goalDiff!: number;
  /** Останні результати, як їх дає провайдер (`W,D,L,W,W`); `null` — немає даних */
  form!: string | null;
  club!: ClubDto;
}

/** Яка це таблиця: стадія й група. */
export class StandingTableRefDto {
  /** `REGULAR_SEASON`, `LEAGUE_STAGE`, `GROUP_STAGE`, … */
  stage!: string;
  /** `GROUP_A` … або `null` — без груп */
  groupName!: string | null;
}

/** Турнірна таблиця. */
export class StandingTableDto extends StandingTableRefDto {
  /** `TOTAL` — загальна; `HOME` / `AWAY` — лише вдома / в гостях */
  @ApiProperty({ enum: StandingType, enumName: 'StandingType' })
  type!: StandingType;

  rows!: StandingRowDto[];
}
