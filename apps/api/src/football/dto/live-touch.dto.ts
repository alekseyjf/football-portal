import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** cuid — 25 символів; межа лише від сміття в запиті, існування перевіряє сервіс. */
const MATCH_ID_MAX_LENGTH = 64;

export class LiveTouchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MATCH_ID_MAX_LENGTH)
  matchId!: string;
}
