import {
  EMAIL_MAX_LENGTH,
  PASSWORD_INPUT_MAX_LENGTH,
} from '@football-portal/validation';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../common/validation/trim-string.transform';

export class LoginDto {
  /** Нормалізація регістру — у сервісі */
  @TrimString()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  /** Без мінімуму: акаунти до 2f мають паролі від 6 символів. Максимум — захист від величезних тіл */
  @IsString()
  @MaxLength(PASSWORD_INPUT_MAX_LENGTH)
  password: string;
}
