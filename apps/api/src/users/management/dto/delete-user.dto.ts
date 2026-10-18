import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/validation/trim-string.transform';

/** `DELETE /users/:id` (ADMIN). Тіло опційне. */
export class DeleteUserDto {
  /** Причина — для аудиту */
  // Зберігається в `UserSanction.note`
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  note?: string;
}
