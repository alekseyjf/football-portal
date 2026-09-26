import { Transform } from 'class-transformer';

/**
 * Прибирає пробіли по краях рядка **до** валідаторів (`MinLength`, `IsEmail`…):
 * інакше `"   "` проходить `MinLength(2)` і зберігається порожнім. Не-рядки не чіпає.
 */
export const TrimString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
