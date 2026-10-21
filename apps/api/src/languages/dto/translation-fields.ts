import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/** Максимум перекладів в одному запиті (новина, тег) — захист від величезних тіл, не бізнес-правило. */
export const TRANSLATIONS_PER_REQUEST_MAX = 10;

/** Формат `Language.code` (`en`, `uk`); чи мова увімкнена — перевіряє сервіс (P3-3). */
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,8}$/;

/** `languageCode` перекладу новини чи назви тегу. */
export const IsTranslationLanguageCode = () =>
  applyDecorators(
    IsString(),
    Matches(LANGUAGE_CODE_PATTERN, {
      message: 'languageCode must be like "en"',
    }),
  );
