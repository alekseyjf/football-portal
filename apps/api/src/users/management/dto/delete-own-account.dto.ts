import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `DELETE /users/me` — підтвердження паролем (P2-15). */
export class DeleteOwnAccountDto {
  /** Як у LoginDto: bcrypt сам обрізає до 72 байт, 256 — лише захист від величезних тіл */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;
}
