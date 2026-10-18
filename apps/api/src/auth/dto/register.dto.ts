import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '@football-portal/validation';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxUtf8Bytes } from '../../common/validation/max-utf8-bytes.decorator';
import { TrimString } from '../../common/validation/trim-string.transform';

/** Межі — з `@football-portal/validation` (ті самі, що у формі реєстрації на web). */
export class RegisterDto {
  /** Регістр не важливий: зберігається в нижньому */
  // Нормалізація регістру — у сервісі
  @TrimString()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  /** Ім'я в профілі */
  // Стає `UserProfile.displayName`
  @TrimString()
  @IsString()
  @MinLength(DISPLAY_NAME_MIN_LENGTH)
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  name!: string;

  /** Від 8 символів до 72 байтів UTF-8 (кирилиця — 2 байти на літеру) */
  // Максимум — межа bcrypt у байтах UTF-8: довший пароль обрізається мовчки
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxUtf8Bytes(PASSWORD_MAX_BYTES)
  password!: string;
}
