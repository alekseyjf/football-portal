import {
  ValidateBy,
  buildMessage,
  type ValidationOptions,
} from 'class-validator';

/** Значення фільтра — через кому: `?tags=transfers,injuries`. */
const SLUG_LIST_SEPARATOR = ',';

/** Формат кожного значення списку й скільки їх може бути. */
export interface SlugListRule {
  /** Формат одного значення; порожнє він не пропускає. Без прапорців `g` / `y`: з ними `test` пам'ятає позицію */
  pattern: RegExp;
  maxLength: number;
  maxValues: number;
}

function isSlugList(value: unknown, rule: SlugListRule): boolean {
  if (typeof value !== 'string') return false;
  const slugs = splitSlugList(value);
  return (
    slugs.length <= rule.maxValues &&
    slugs.every(
      (slug) => slug.length <= rule.maxLength && rule.pattern.test(slug),
    )
  );
}

/**
 * Query-параметр зі списком slug-ів через кому (`?tags=transfers,injuries`): до `maxValues` значень,
 * кожне — за `pattern` і не довше за `maxLength`. Порожнє значення (`?tags=`, `a,,b`) і повтор
 * параметра (`?tags=a&tags=b` приходить масивом) → 400: у списку одна форма запису.
 */
export function IsSlugList(
  rule: SlugListRule,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSlugList',
      constraints: [rule.maxValues, rule.maxLength, rule.pattern],
      validator: {
        validate: (value: unknown) => isSlugList(value, rule),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be up to $constraint1 comma-separated values, each matching $constraint3 and at most $constraint2 characters long`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

/** Значення списку, який уже перевірив `IsSlugList`: `transfers,injuries` → `['transfers', 'injuries']`. */
export function splitSlugList(slugList: string): string[] {
  return slugList.split(SLUG_LIST_SEPARATOR);
}
