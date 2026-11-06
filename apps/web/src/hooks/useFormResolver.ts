import { useTranslations } from 'next-intl';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';
import {
  formResolver,
  translateFormIssue,
  type FormErrorTranslator,
} from '@/lib/forms/form-resolver';

/** Resolver форми сайту: помилки полів — мовою сторінки, з `messages` (`validation.*`, M1.9). */
export function useFormResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  const t = useTranslations();
  // Для об'єднання ключів суворі типи next-intl вимагають числа всіх ключів разом; що кожен ключ отримує свої,
  // перевіряє тест каталогу (`form-resolver.test.ts`: текст кожного ключа кожною мовою з його параметрами)
  const translate: FormErrorTranslator = (key, values) =>
    t(key, values as never);
  return formResolver(schema, (issue) => translateFormIssue(issue, translate));
}
