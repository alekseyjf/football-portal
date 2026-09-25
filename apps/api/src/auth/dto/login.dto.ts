import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** Пробіли по краях прибираємо до @IsEmail; нормалізація регістру — у сервісі */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Не 72, як у RegisterDto: bcrypt сам обрізає до 72 байт, а тут лише захист від величезних тіл */
  @IsString()
  @MaxLength(256)
  password: string;
}
