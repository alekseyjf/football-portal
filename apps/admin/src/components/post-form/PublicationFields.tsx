'use client';

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { FormField } from './FormField';
import { controlProps } from './formStyles';
import { DEPENDENT_FIELD_NAMES, hasUkText, UK_FIELD_NAMES, type PostFormValues } from './postFormSchema';

const PUBLICATION_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible on the site' },
  { value: 'PUBLISHED', label: 'Publish now', hint: 'Visible immediately' },
  { value: 'SCHEDULED', label: 'Schedule', hint: 'Goes live at the chosen time' },
] as const;

/** Поточний момент у форматі `datetime-local` — нижня межа поля. */
function localDateTimeNow(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

interface PublicationFieldsProps {
  register: UseFormRegister<PostFormValues>;
  control: Control<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}

/** Статус публікації й час розкладу; без української версії — попередження (D23). */
export function PublicationFields({ register, control, errors }: PublicationFieldsProps) {
  const publication = useWatch({ control, name: 'publication' });
  const ukFieldValues = useWatch({ control, name: UK_FIELD_NAMES });
  // Лише попередження, не блок (D23): без UK новина виходить, а термінова не чекає перекладу
  const isPublishingWithoutUk = publication !== 'DRAFT' && !hasUkText(ukFieldValues);

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-300">Publication</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {PUBLICATION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 transition-colors ${
              publication === option.value
                ? 'border-green-500 bg-green-600/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-gray-200">
              <input
                {...register('publication', { deps: DEPENDENT_FIELD_NAMES.publication })}
                type="radio"
                value={option.value}
                className="accent-green-500"
              />
              {option.label}
            </span>
            <span className="mt-0.5 text-xs text-gray-500">{option.hint}</span>
          </label>
        ))}
      </div>

      {publication === 'SCHEDULED' && (
        <FormField
          fieldId="scheduledAt"
          label={
            <>
              Goes live at <span className="font-normal text-gray-500">(your local time)</span>
            </>
          }
          error={errors.scheduledAt?.message}
        >
          <input
            {...register('scheduledAt')}
            {...controlProps('scheduledAt', !!errors.scheduledAt)}
            type="datetime-local"
            min={localDateTimeNow()}
          />
        </FormField>
      )}

      {isPublishingWithoutUk && (
        <p
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          No Ukrainian translation: on /uk/ the post will be shown in English, marked “translation
          unavailable”.
        </p>
      )}
    </fieldset>
  );
}
