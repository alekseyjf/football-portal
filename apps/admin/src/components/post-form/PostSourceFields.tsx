import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FormField, OptionalMark } from './FormField';
import { controlProps } from './formStyles';
import { DEPENDENT_FIELD_NAMES, type PostFormValues } from './postFormSchema';

interface PostSourceFieldsProps {
  register: UseFormRegister<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}

/** Джерело новини (D26): одне — адреса статті й назва видання; решту джерел перелічують у тексті. */
export function PostSourceFields({ register, errors }: PostSourceFieldsProps) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">
        Source <OptionalMark />
      </legend>
      <p className="text-xs text-gray-500">
        For a post based on another outlet’s article. Under the text the site shows “Source: BBC Sport ↗”;
        without a name — the domain of the URL.
      </p>
      <FormField fieldId="sourceUrl" label="Article URL" error={errors.sourceUrl?.message}>
        <input
          {...register('sourceUrl')}
          {...controlProps('sourceUrl', !!errors.sourceUrl)}
          placeholder="https://www.bbc.com/sport/football/articles/…"
        />
      </FormField>
      <FormField fieldId="sourceName" label="Outlet name" error={errors.sourceName?.message}>
        <input
          {...register('sourceName', { deps: DEPENDENT_FIELD_NAMES.sourceName })}
          {...controlProps('sourceName', !!errors.sourceName)}
          placeholder="BBC Sport"
        />
      </FormField>
    </fieldset>
  );
}
