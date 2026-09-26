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
  /** Нормалізація регістру — у сервісі */
  @TrimString()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  /** Стає `UserProfile.displayName` */
  @TrimString()
  @IsString()
  @MinLength(DISPLAY_NAME_MIN_LENGTH)
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  name: string;

  /** Максимум — межа bcrypt у байтах UTF-8: довший пароль обрізається мовчки */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxUtf8Bytes(PASSWORD_MAX_BYTES)
  password: string;
}
