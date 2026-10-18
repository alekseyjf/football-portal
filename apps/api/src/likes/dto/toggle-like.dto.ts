import { ApiProperty } from '@nestjs/swagger';
import { LikeType } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Цілі реакцій — сегмент `GET /likes/stats/{targetType}/…` і поле `targetType` тіла. */
export const LIKE_TARGET_TYPES = ['post', 'comment', 'match'] as const;

export type LikeTargetTypeDto = (typeof LIKE_TARGET_TYPES)[number];

/** cuid — 25 символів; межа лише від сміття в запиті, існування цілі перевіряє сервіс. */
const LIKE_TARGET_ID_MAX_LENGTH = 64;

export class ToggleLikeDto {
  @ApiProperty({ enum: LIKE_TARGET_TYPES, enumName: 'LikeTargetType' })
  @IsIn(LIKE_TARGET_TYPES)
  targetType!: LikeTargetTypeDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(LIKE_TARGET_ID_MAX_LENGTH)
  targetId!: string;

  /** Як на YouTube: повтор тієї ж дії знімає голос */
  @ApiProperty({ enum: LikeType, enumName: 'LikeType' })
  @IsEnum(LikeType)
  action!: LikeType;
}
