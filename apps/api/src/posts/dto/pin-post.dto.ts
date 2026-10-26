import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/** cuid — 25 символів; межа лише від сміття в запиті, існування перевіряє сервіс. */
const POST_ID_MAX_LENGTH = 64;

/** Тіло `POST /posts/{id}/pin`. */
export class PinPostDto {
  /**
   * Яку новину замінює ця — id закріпленої, яку редактор бачив у підтвердженні; `null` — закріпленої не було.
   * Закріплена встигла змінитись → 409 `PINNED_POST_CHANGED`
   */
  // Обов'язкове, і `null` теж треба передати явно: підтвердження заміни чесне, лише коли клієнт каже, що бачив (D56)
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(POST_ID_MAX_LENGTH)
  replacesPostId!: string | null;
}
