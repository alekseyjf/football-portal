import { PASSWORD_INPUT_MAX_LENGTH } from '@football-portal/validation';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `DELETE /users/me` — підтвердження паролем (P2-15). */
export class DeleteOwnAccountDto {
  /** Як у LoginDto: введений пароль, без політики довжини нового */
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_INPUT_MAX_LENGTH)
  password: string;
}
