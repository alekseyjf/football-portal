import { ApiProperty } from '@nestjs/swagger';
import { LikeType } from '@prisma/client';

/** Реакції на ціль, як на YouTube: публічно — лише лайки (дизлайки бачить адмін) і свій голос. */
export class LikeStatsDto {
  likesCount!: number;

  /** Мій голос; `null` — не голосував або гість */
  @ApiProperty({ enum: LikeType, enumName: 'LikeType', nullable: true })
  myReaction!: LikeType | null;
}
