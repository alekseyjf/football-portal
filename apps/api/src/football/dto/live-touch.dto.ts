import { IsString, MinLength } from 'class-validator';

export class LiveTouchDto {
  @IsString()
  @MinLength(8)
  matchId!: string;
}
