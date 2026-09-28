import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/**
 * Дата-час з явною часовою зоною (`Z` або `±hh:mm`): `2026-10-01T10:00` без зони сервер
 * прочитав би у своїй зоні — запланований пост вийшов би не тоді, межа дня в календарі зсунулась би.
 */
const ISO_DATE_WITH_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

/** Строгий ISO 8601 з обов'язковою зоною (`publishedAt` поста, межі інтервалу матчів). */
export const IsIsoDateTimeWithZone = (fieldName: string) =>
  applyDecorators(
    IsISO8601({ strict: true, strictSeparator: true }),
    Matches(ISO_DATE_WITH_ZONE_PATTERN, {
      message: `${fieldName} must include a time zone (Z or ±hh:mm)`,
    }),
  );
