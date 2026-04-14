import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export type LikeTargetTypeDto = 'post' | 'comment' | 'match';

export class ToggleLikeDto {
  @IsIn(['post', 'comment', 'match'])
  targetType!: LikeTargetTypeDto;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  /** Як на YouTube: натискання тієї ж кнопки знімає голос. */
  @IsIn(['LIKE', 'DISLIKE'])
  action!: 'LIKE' | 'DISLIKE';
}
