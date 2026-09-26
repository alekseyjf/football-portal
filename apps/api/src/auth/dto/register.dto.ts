import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  /** Пробіли по краях прибираємо до @IsEmail; нормалізація регістру — у сервісі */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Стає `UserProfile.displayName`. Trim до `MinLength`: інакше ім'я з пробілів проходить і стає порожнім */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  /** 72 байти — межа bcrypt: довший пароль обрізається мовчки */
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
