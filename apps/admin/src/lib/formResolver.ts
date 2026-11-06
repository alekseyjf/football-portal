import { toNestErrors } from '@hookform/resolvers';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { formFieldErrors } from '@football-portal/validation/forms';
import { formIssueMessage } from '@/lib/formErrorMessages';

/**
 * Resolver React Hook Form для zod-схеми (M1.9): як `zodResolver`, але текст помилки — з мапи адмінки за ключем і
 * числами issue (`zodResolver` лишив би лише ключ). Так само — у web (`lib/forms/form-resolver.ts`, з перекладом через
 * `messages`): міняти разом.
 */
export function formResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    return { values: {}, errors: toNestErrors(formFieldErrors(result.error.issues, formIssueMessage), options) };
  };
}
