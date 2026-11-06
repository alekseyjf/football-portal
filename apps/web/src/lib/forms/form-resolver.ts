import { toNestErrors } from '@hookform/resolvers';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';
import {
  formErrorParams,
  formFieldErrors,
  isSiteFormErrorKey,
  type FormErrorParams,
  type FormIssue,
  type SiteFormErrorKey,
} from '@football-portal/validation/forms';

/** Загальна помилка поля — коли ключа немає серед форм сайту. */
export const GENERIC_FORM_ERROR_KEY = 'validation.invalid';

/** Від перекладача next-intl потрібні лише ключ `validation.*` і числа тексту. */
export type FormErrorTranslator = (
  key: SiteFormErrorKey | typeof GENERIC_FORM_ERROR_KEY,
  values: FormErrorParams,
) => string;

/**
 * Текст помилки поля мовою сторінки (M1.9): у схемі — ключ, числа — з issue. Ключ не з форм сайту чи текст zod за
 * замовчуванням — загальна помилка, а не сирий ключ.
 */
export function translateFormIssue(
  issue: FormIssue,
  translate: FormErrorTranslator,
): string {
  if (!isSiteFormErrorKey(issue.message)) {
    return translate(GENERIC_FORM_ERROR_KEY, {});
  }
  return translate(issue.message, formErrorParams(issue));
}

/**
 * Resolver React Hook Form для zod-схеми (M1.9): як `zodResolver`, але текст помилки будує `translate` з усього issue —
 * `zodResolver` лишає від нього лише `message`, тобто ключ без чисел. Так само — в адмінці (`lib/formResolver.ts`, з її
 * англійською мапою): міняти разом.
 */
export function formResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
  translate: (issue: FormIssue) => string,
): Resolver<Input, unknown, Output> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    return {
      values: {},
      errors: toNestErrors(
        formFieldErrors(result.error.issues, translate),
        options,
      ),
    };
  };
}
