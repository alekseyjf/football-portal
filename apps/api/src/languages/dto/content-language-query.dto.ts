import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

/** `?lang=` — мова контенту. */
export class ContentLanguageQueryDto {
  /** Код мови (`en`, `uk`); невідома чи вимкнена — default-мова (`en`), без 400 */
  // Без валідації: як трактувати будь-яке значення, вирішує `LanguageService` (розділ 8, P3-3);
  // `@Allow` — щоб whitelist не прибрав поле
  @ApiPropertyOptional({ type: String, example: 'uk' })
  @Allow()
  lang?: unknown;
}
