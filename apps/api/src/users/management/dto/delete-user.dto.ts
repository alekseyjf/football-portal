import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** `DELETE /users/:id` (ADMIN). Тіло опційне. */
export class DeleteUserDto {
  /** Причина — у `UserSanction.note` для аудиту */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  note?: string;
}
